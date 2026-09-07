const cron = require('node-cron');
const metaService = require('./metaService');
const whatsappService = require('./whatsappService');
const {
  db,
  getSetting,
  setSetting,
  upsertConversation,
  upsertInboxMessage,
  getInboxMessagesByConversation,
  getUnnotifiedMessages,
  markMessageNotified,
  upsertInboxComment,
  getUnnotifiedComments,
  markCommentNotified
} = require('../database/db');

class InboxSyncService {
  constructor() {
    this.cronTask = null;
    this.isSyncing = false;
  }

  /**
   * Inicia el demonio de sincronización periódica
   */
  start() {
    console.log('🔄 Iniciando Inbox & WhatsApp Sync Worker (chequeo cada 90s)...');

    // Ejecutar sincronización inicial diferida tras 10 segundos para no bloquear el arranque
    setTimeout(() => {
      this.syncAll().catch(err => console.error('[InboxSync] Error en primera sincronización:', err.message));
    }, 10000);

    // Tarea cron cada 90 segundos (ejecuta en segundo plano)
    this.cronTask = cron.schedule('*/90 * * * * *', async () => {
      await this.syncAll().catch(err => {
        console.error('[InboxSync] Error en ciclo cron:', err.message);
      });
    });
  }

  /**
   * Detiene el worker
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }

  /**
   * Ejecuta la sincronización completa de DMs y Comentarios
   */
  async syncAll() {
    if (this.isSyncing) {
      return { skipped: true, reason: 'Ya hay una sincronización en progreso.' };
    }

    this.isSyncing = true;
    const stats = { newMessages: 0, newComments: 0, notificationsSent: 0 };

    try {
      // 1. Sincronizar Conversaciones y DMs
      const convStats = await this.syncConversations();
      stats.newMessages += convStats.newMessages;

      // 2. Sincronizar Comentarios
      const commentStats = await this.syncComments();
      stats.newComments += commentStats.newComments;

      // 3. Despachar notificaciones pendientes a WhatsApp
      const notifStats = await this.dispatchPendingWhatsAppNotifications();
      stats.notificationsSent += notifStats.sent;

      setSetting('inbox_last_synced_at', new Date().toISOString());

      return {
        success: true,
        stats,
        syncedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[InboxSync] Error global durante sincronización:', err.message);
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza conversaciones y mensajes recientes
   */
  async syncConversations() {
    let newMessages = 0;
    try {
      const conversations = await metaService.getConversations(15);

      for (const conv of conversations) {
        // Guardar o actualizar la conversación en SQLite
        upsertConversation(conv);

        // Obtener los mensajes del hilo
        const messages = await metaService.getConversationMessages(conv.id, conv.platform);
        for (const msg of messages) {
          // Comprobar si ya existe
          const exists = db.prepare('SELECT id, notified_whatsapp FROM inbox_messages WHERE id = ?').get(msg.id);
          if (!exists) {
            upsertInboxMessage(msg);
            if (msg.sender_type === 'customer') {
              newMessages++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[InboxSync] Error sincronizando conversaciones:', err.message);
    }
    return { newMessages };
  }

  /**
   * Sincroniza comentarios de publicaciones recientes
   */
  async syncComments() {
    let newComments = 0;
    try {
      const comments = await metaService.getRecentComments(25);

      for (const c of comments) {
        const exists = db.prepare('SELECT id, notified_whatsapp FROM inbox_comments WHERE id = ?').get(c.id);
        if (!exists) {
          upsertInboxComment(c);
          newComments++;
        } else {
          // Actualizar estado de respuesta si cambió
          upsertInboxComment(c);
        }
      }
    } catch (err) {
      console.warn('[InboxSync] Error sincronizando comentarios:', err.message);
    }
    return { newComments };
  }

  /**
   * Revisa mensajes y comentarios nuevos sin notificar y envía el WhatsApp
   */
  async dispatchPendingWhatsAppNotifications() {
    let sent = 0;
    const config = whatsappService.getConfig();

    if (!config.enabled || !config.phone || !config.apiKey) {
      // Si las notificaciones están apagadas, marcar los mensajes como notificados para no acumular spam
      db.prepare("UPDATE inbox_messages SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      db.prepare("UPDATE inbox_comments SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      return { sent: 0, reason: 'WhatsApp desactivado o sin credenciales' };
    }

    // 1. Notificar DMs no notificados
    if (config.notifyDms) {
      const unnotifiedMsgs = getUnnotifiedMessages();
      for (const msg of unnotifiedMsgs) {
        try {
          await whatsappService.notifyDirectMessage({
            senderName: msg.sender_name || 'Cliente',
            messageText: msg.message_text,
            platform: msg.platform
          });
          markMessageNotified(msg.id);
          sent++;
          // Pequeña pausa de 800ms entre envíos para no saturar la API
          await new Promise(r => setTimeout(r, 800));
        } catch (err) {
          console.error(`[InboxSync] Error notificando mensaje ${msg.id} a WhatsApp:`, err.message);
          // Marcar de todos modos para evitar bucle infinito de reintentos
          markMessageNotified(msg.id);
        }
      }
    } else {
      db.prepare("UPDATE inbox_messages SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
    }

    // 2. Notificar Comentarios no notificados
    if (config.notifyComments) {
      const unnotifiedComments = getUnnotifiedComments();
      for (const c of unnotifiedComments) {
        try {
          await whatsappService.notifyComment({
            authorName: c.from_name || 'Usuario',
            commentText: c.comment_text,
            postCaption: c.post_caption,
            platform: c.platform
          });
          markCommentNotified(c.id);
          sent++;
          await new Promise(r => setTimeout(r, 800));
        } catch (err) {
          console.error(`[InboxSync] Error notificando comentario ${c.id} a WhatsApp:`, err.message);
          markCommentNotified(c.id);
        }
      }
    } else {
      db.prepare("UPDATE inbox_comments SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
    }

    return { sent };
  }
}

module.exports = new InboxSyncService();
