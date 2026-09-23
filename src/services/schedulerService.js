const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { db, getSetting } = require('../database/db');
const metaService = require('./metaService');
const videoService = require('./videoService');
const imageService = require('./imageService');

class SchedulerService {
  cronTask = null;
  isProcessing = false;

  /**
   * Inicia el demonio de ejecución periódica (cada 1 minuto)
   */
  start() {
    console.log('⏰ Iniciando motor de programación (Scheduler Cron) cada minuto...');
    
    this.cronTask = cron.schedule('* * * * *', async () => {
      await this.processDuePosts();
    });

    // Ejecución inicial al arrancar
    setTimeout(() => {
      this.processDuePosts();
    }, 3000);
  }

  /**
   * Detiene el cron si es necesario
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('🛑 Scheduler Cron detenido.');
    }
  }

  /**
   * Procesa las publicaciones cuya fecha/hora programada ha llegado
   */
  async processDuePosts() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const nowIso = new Date().toISOString();

      // Buscar posts en estado scheduled
      const candidates = db.prepare(`
        SELECT * FROM posts
        WHERE status = 'scheduled' AND scheduled_at IS NOT NULL
        ORDER BY scheduled_at ASC
        LIMIT 25
      `).all();

      const nowMs = Date.now();
      const duePosts = candidates.filter(p => {
        const postMs = new Date(p.scheduled_at).getTime();
        return !isNaN(postMs) && postMs <= nowMs;
      }).slice(0, 10);

      if (duePosts.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`🚀 [Scheduler] Procesando ${duePosts.length} publicaciones pendientes...`);

      for (const post of duePosts) {
        await this.publishSinglePost(post);
      }
    } catch (err) {
      console.error('❌ Error en ciclo de scheduler:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  getAccountCredentials(post) {
    let targetPageId = null;
    let targetPageToken = null;
    let targetInstagramId = null;

    if (post && post.account_id) {
      try {
        const cachedStr = getSetting('cached_managed_accounts');
        if (cachedStr) {
          const accounts = JSON.parse(cachedStr);
          const acc = accounts.find(a => String(a.pageId) === String(post.account_id));
          if (acc && acc.pageToken) {
            targetPageId = acc.pageId;
            targetPageToken = acc.pageToken;
            if (acc.instagram && acc.instagram.id) {
              targetInstagramId = acc.instagram.id;
            }
          }
        }
      } catch (_) {}
    }

    return { targetPageId, targetPageToken, targetInstagramId };
  }

  async dispatchToFacebook(post, mediaUrls, creds = {}) {
    try {
      return await metaService.publishToFacebook({
        message: post.content,
        mediaUrls: mediaUrls,
        postType: post.post_type,
        customPageId: creds.targetPageId,
        customPageToken: creds.targetPageToken
      });
    } catch (fbErr) {
      const msg = fbErr.response ? (fbErr.response.data.error?.message || fbErr.message) : fbErr.message;
      return { success: false, error: msg };
    }
  }

  async dispatchToInstagram(post, mediaUrls, creds = {}) {
    try {
      return await metaService.publishToInstagram({
        message: post.content,
        mediaUrls: mediaUrls,
        postType: post.post_type,
        customInstagramId: creds.targetInstagramId,
        customPageToken: creds.targetPageToken
      });
    } catch (igErr) {
      const msg = igErr.response ? (igErr.response.data.error?.message || igErr.message) : igErr.message;
      return { success: false, error: msg };
    }
  }

  /**
   * Despacha un post individual a las plataformas seleccionadas
   */
  async publishSinglePost(post) {
    // 1. Marcar inmediatamente como 'processing' para evitar duplicados
    db.prepare(`
      UPDATE posts
      SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(post.id);

    console.log(`📤 Publicando Post ID ${post.id} ("${post.title || 'Sin título'}") [Cuenta: ${post.account_name || post.account_id || 'Predeterminada'}]...`);

    const platforms = JSON.parse(post.platforms || '["facebook","instagram"]');
    const mediaUrls = JSON.parse(post.media_urls || '[]');
    const creds = this.getAccountCredentials(post);
    const results = {};
    let hasError = false;
    let errorMessage = '';

    try {
      // Asegurar que si el post es de tipo 'story', su medio esté adaptado a 1080x1920 9:16 sin recortar bordes
      if (post.post_type === 'story' && mediaUrls.length > 0) {
        try {
          const firstMedia = mediaUrls[0];
          const isVid = Boolean(firstMedia && (/\.(mp4|mov|webm)$/i.test(firstMedia.split('?')[0]) || firstMedia.includes('/uploads/stories/')));
          if (isVid) {
            const dims = await videoService.getVideoDimensions(firstMedia.startsWith('http') ? firstMedia : path.join(__dirname, '../../', firstMedia.replace(/^\/+/, '')));
            if (dims.width > 0 && dims.height > 0 && (dims.width !== 1080 || dims.height !== 1920)) {
              console.log(`[Scheduler] 🎬 Adaptando video de Story #${post.id} (${dims.width}x${dims.height}) a 1080x1920 9:16 con fondo blur...`);
              const conv = await videoService.convertVideoToStoryVideo({ videoInput: firstMedia });
              mediaUrls[0] = conv.relativeUrl;
              db.prepare('UPDATE posts SET media_urls = ? WHERE id = ?').run(JSON.stringify(mediaUrls), post.id);
            }
          } else {
            const absImg = firstMedia.startsWith('http') ? firstMedia : path.join(__dirname, '../../', firstMedia.replace(/^\/+/, ''));
            const card = await imageService.createStoryCard({ inputImagePath: absImg, brandName: post.account_name || '' });
            if (card?.relativeUrl && card.relativeUrl !== firstMedia) {
              console.log(`[Scheduler] 📲 Adaptando imagen de Story #${post.id} a 1080x1920 9:16 con fondo blur...`);
              mediaUrls[0] = card.relativeUrl;
              db.prepare('UPDATE posts SET media_urls = ? WHERE id = ?').run(JSON.stringify(mediaUrls), post.id);
            }
          }
        } catch (storyAdaptErr) {
          console.warn('[Scheduler] Advertencia al verificar/adaptar formato de Story:', storyAdaptErr.message);
        }
      }

      if (platforms.includes('facebook')) {
        results.facebook = await this.dispatchToFacebook(post, mediaUrls, creds);
        if (!results.facebook.success) {
          hasError = true;
          errorMessage += `FB: ${results.facebook.error}; `;
        }
      }

      if (platforms.includes('instagram')) {
        results.instagram = await this.dispatchToInstagram(post, mediaUrls, creds);
        if (!results.instagram.success) {
          hasError = true;
          errorMessage += `IG: ${results.instagram.error}; `;
        }
      }

      const isAnySuccess = results.facebook?.success || results.instagram?.success;

      if (!isAnySuccess && hasError) {
        throw new Error(errorMessage.trim());
      }

      // Éxito (total o en al menos una plataforma)
      db.prepare(`
        UPDATE posts
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            meta_result = ?,
            error_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(results), hasError ? errorMessage.trim() : null, post.id);

      console.log(`✅ Post ID ${post.id} procesado exitosamente en Meta:`, results);
    } catch (err) {
      this.handlePublishFailure(post, err, results);
    }
  }

  handlePublishFailure(post, err, results) {
    console.error(`❌ Falló la publicación del Post ID ${post.id}:`, err.message);

    const currentRetries = post.retry_count + 1;
    const maxRetries = post.max_retries || 3;

    if (currentRetries < maxRetries) {
      // Reintentar con backoff (+5 minutos)
      const nextRetryDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE posts
        SET status = 'scheduled',
            scheduled_at = ?,
            retry_count = ?,
            error_message = ?,
            meta_result = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextRetryDate, currentRetries, err.message, JSON.stringify(results), post.id);

      console.log(`🔁 Post ID ${post.id} reprogramado para reintento #${currentRetries} a las ${nextRetryDate}`);
    } else {
      // Marcado como fallido definitivo
      db.prepare(`
        UPDATE posts
        SET status = 'failed',
            retry_count = ?,
            error_message = ?,
            meta_result = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(currentRetries, err.message, JSON.stringify(results), post.id);

      console.log(`🚫 Post ID ${post.id} marcado como FAILED tras ${currentRetries} intentos.`);
    }
  }

  /**
   * Calcula el siguiente slot disponible basado en la configuración de la semana
   */
  getNextAvailableSlot() {
    const activeSlots = db.prepare(`
      SELECT day_of_week, time_slot
      FROM schedule_slots
      WHERE is_active = 1
      ORDER BY day_of_week ASC, time_slot ASC
    `).all();

    if (activeSlots.length === 0) {
      // Fallback: dentro de 1 hora
      const d = new Date();
      d.setHours(d.getHours() + 1);
      return d.toISOString();
    }

    const scheduledPosts = db.prepare(`
      SELECT scheduled_at FROM posts
      WHERE status = 'scheduled' AND scheduled_at >= ?
    `).all(new Date().toISOString()).map(p => p.scheduled_at);

    const now = new Date();
    // Buscar en los próximos 14 días
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const candidateDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = candidateDate.getDay(); // 0-6

      const matchingSlots = activeSlots.filter(s => s.day_of_week === dayOfWeek);

      for (const slot of matchingSlots) {
        const [hours, minutes] = slot.time_slot.split(':').map(Number);
        const slotDateTime = new Date(candidateDate);
        slotDateTime.setHours(hours, minutes, 0, 0);

        // Si ya pasó hoy, continuar
        if (slotDateTime <= now) {
          continue;
        }

        const slotIso = slotDateTime.toISOString();

        // Verificar si ya hay un post agendado dentro de una ventana de 10 minutos de este slot
        const isOccupied = scheduledPosts.some(scheduledIso => {
          const scheduledTime = new Date(scheduledIso).getTime();
          const targetTime = slotDateTime.getTime();
          return Math.abs(scheduledTime - targetTime) < 10 * 60 * 1000;
        });

        if (!isOccupied) {
          return slotIso;
        }
      }
    }

    // Fallback: mañana a las 10:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }
}

module.exports = new SchedulerService();
