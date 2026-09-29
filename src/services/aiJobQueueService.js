const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createAiJob, getAiJob, updateAiJob, getSetting, db } = require('../database/db');

class AIJobQueueService {
  constructor() {
    this.listeners = new Map(); // jobId -> Set<res>
    this.activeJobsCount = 0;
  }

  /**
   * Encola una tarea pesada de generación de imágenes y la procesa en segundo plano
   */
  enqueueImageJob(payload) {
    const jobId = crypto.randomUUID();
    createAiJob(jobId, 'image_generation', payload);

    setImmediate(() => {
      this.executeImageJob(jobId, payload);
    });

    return {
      success: true,
      jobId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Ejecuta la tarea en segundo plano con control de errores y notificación SSE
   */
  async executeImageJob(jobId, payload) {
    this.activeJobsCount++;
    try {
      updateAiJob(jobId, 'processing');
      this.broadcast(jobId, 'status', { status: 'processing', progress: 25, message: 'Iniciando generación de imagen...' });

      const aiService = require('./aiService');
      const metaService = require('./metaService');
      const imageService = require('./imageService');

      const { prompt, format = 'feed', model, baseImageUrl, account_id, account_name } = payload;
      const rawAccountParam = account_id || getSetting('meta_page_id') || '';
      const creds = metaService.getAccountCredentials(rawAccountParam);
      const activeAccountName = creds?.name || account_name || getSetting('meta_page_name') || '';
      const igUsername = creds?.instagram?.username || '';
      const isKmarket = activeAccountName.toLowerCase().includes('kmarket');
      const isAgendio = activeAccountName.toLowerCase().includes('agendio') || igUsername.toLowerCase().includes('agendio');

      let finalPrompt = prompt || (isAgendio ? 'Cabaña de madera nativa chilena iluminada al atardecer en bosque nativo' : 'Afiche publicitario 4:5 de este producto');
      let result = null;

      this.broadcast(jobId, 'status', { status: 'processing', progress: 50, message: 'Procesando diseño visual...' });

      if (isKmarket && baseImageUrl) {
        result = await aiService.generateKmarketDesignerPoster({
          baseImageUrl,
          productName: prompt,
          extraNotes: ''
        });
      } else {
        result = await aiService.generateDirectImage({
          prompt: finalPrompt,
          format,
          model,
          accountName: isAgendio ? 'Agendio' : (isKmarket ? '' : activeAccountName),
          baseImageUrl
        });
      }

      this.broadcast(jobId, 'status', { status: 'processing', progress: 80, message: 'Aplicando optimizaciones finales y sellos...' });

      // Auto-estampado de marca de agua si corresponde
      try {
        if (getSetting('auto_stamp_seal') !== 'false' && result?.url) {
          const activeAccId = rawAccountParam || getSetting('meta_page_id') || '';
          if (activeAccId) {
            const wmRow = db.prepare('SELECT * FROM watermarks WHERE account_id = ? ORDER BY is_default DESC, id DESC LIMIT 1').get(activeAccId);
            if (wmRow) {
              const wmPath = path.join(__dirname, '../../uploads/watermarks', wmRow.filename);
              const cleanGenPath = result.url.replace(/^[\\/]+/, '');
              const genFullPath = path.join(__dirname, '../../', cleanGenPath);
              if (fs.existsSync(wmPath) && fs.existsSync(genFullPath)) {
                const stamped = await imageService.applyWatermark({
                  inputImagePath: genFullPath,
                  watermarkPath: wmPath,
                  position: 'bottom-right',
                  opacity: 1.0,
                  scalePercent: 18
                });
                result.url = stamped.relativeUrl;
                result.filename = stamped.filename;
              }
            }
          }
        }
      } catch (stampErr) {
        console.warn(`[JobQueue ${jobId}] No se pudo auto-estampar sello:`, stampErr.message);
      }

      // Registrar en galería media_items
      try {
        const activeAccountId = account_id || getSetting('meta_page_id') || '';
        db.prepare(`
          INSERT INTO media_items (filename, original_name, filepath, mime_type, width, height, account_id, account_name)
          VALUES (?, ?, ?, 'image/jpeg', ?, ?, ?, ?)
        `).run(
          result.filename,
          `AI-${(prompt || 'Imagen').slice(0, 25)}.jpg`,
          result.url,
          result.width,
          result.height,
          activeAccountId,
          activeAccountName
        );
      } catch (dbErr) {
        console.warn(`[JobQueue ${jobId}] No se pudo registrar media_item:`, dbErr.message);
      }

      updateAiJob(jobId, 'completed', result, null);
      this.broadcast(jobId, 'completed', { status: 'completed', progress: 100, result });
      this.closeJobListeners(jobId);
    } catch (err) {
      console.error(`[JobQueue ${jobId}] ❌ Error en ejecución de trabajo:`, err);
      updateAiJob(jobId, 'failed', null, err.message);
      this.broadcast(jobId, 'failed', { status: 'failed', error: err.message });
      this.closeJobListeners(jobId);
    } finally {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }
  }

  /**
   * Obtiene el estado actual de un trabajo
   */
  getJob(jobId) {
    return getAiJob(jobId);
  }

  /**
   * Conecta un cliente a un stream SSE para recibir actualizaciones en tiempo real
   */
  attachSSEStream(jobId, req, res) {
    const job = this.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Trabajo no encontrado' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    // Enviar estado inicial
    res.write(`event: snapshot\ndata: ${JSON.stringify(job)}\n\n`);

    // Si ya terminó, cerrar inmediatamente
    if (job.status === 'completed' || job.status === 'failed') {
      res.end();
      return;
    }

    // Registrar en listeners
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    const set = this.listeners.get(jobId);
    set.add(res);

    // Heartbeat ping cada 15 segundos
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) {
        this.listeners.delete(jobId);
      }
    });
  }

  /**
   * Envía eventos SSE a los suscriptores de un trabajo
   */
  broadcast(jobId, event, data) {
    const set = this.listeners.get(jobId);
    if (!set || set.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of set) {
      try {
        client.write(payload);
      } catch (_) {
        set.delete(client);
      }
    }
  }

  /**
   * Cierra todas las conexiones SSE asociadas a un trabajo finalizado
   */
  closeJobListeners(jobId) {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const client of set) {
      try {
        client.end();
      } catch (_) {}
    }
    this.listeners.delete(jobId);
  }
}

module.exports = new AIJobQueueService();
