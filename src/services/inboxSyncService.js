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
  cronTask = null;
  isSyncing = false;

  /**
   * Inicia el demonio de sincronización periódica
   */
  start() {
    console.log('🔄 Iniciando Inbox & WhatsApp Sync Worker (chequeo cada 90s)...');

    // Recuperar comentarios recientes no respondidos que pudieron quedar silenciados por bug anterior
    this.recoverUnansweredRecentItems();

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
   * Recupera comentarios recientes sin responder que pudieron haber quedado erróneamente
   * marcados como notificados
   */
  recoverUnansweredRecentItems() {
    try {
      const res = db.prepare(`
        UPDATE inbox_comments 
        SET notified_whatsapp = 0 
        WHERE is_answered = 0 
          AND notified_whatsapp = 1 
          AND datetime(created_at) >= datetime('now', '-24 hours')
      `).run();
      if (res && res.changes > 0) {
        console.log(`[InboxSync] 🔄 Se reactivaron ${res.changes} comentarios recientes sin responder para despachar alerta WhatsApp.`);
      }
    } catch (e) {
      console.warn('[InboxSync] Error recuperando comentarios sin responder:', e.message);
    }
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
  async syncAll(targetAccountId = null) {
    if (this.isSyncing) {
      return { skipped: true, reason: 'Ya hay una sincronización en progreso.' };
    }

    this.isSyncing = true;
    const stats = { newMessages: 0, newComments: 0, notificationsSent: 0 };

    try {
      // Determinar qué cuentas sincronizar
      let accountsToSync = [];
      if (targetAccountId) {
        const creds = metaService.getAccountCredentials(targetAccountId);
        accountsToSync = [creds];
      } else {
        // En background sync, sincronizar todas las cuentas conectadas no ocultas
        try {
          const cachedStr = getSetting('cached_managed_accounts');
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              accountsToSync = parsed.filter(p => !p.isHidden).map(p => metaService.getAccountCredentials(p));
            }
          }
        } catch (err) {
          // Ignorado si cached_managed_accounts está vacío o no es JSON válido
        }

        if (accountsToSync.length === 0) {
          accountsToSync = [metaService.getConfig()];
        }
      }

      for (const acc of accountsToSync) {
        // 1. Sincronizar Conversaciones y DMs para esta cuenta
        const convStats = await this.syncConversations(acc);
        stats.newMessages += convStats.newMessages;

        // 2. Sincronizar Comentarios para esta cuenta
        const commentStats = await this.syncComments(acc);
        stats.newComments += commentStats.newComments;
      }

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
  async syncConversations(accountCreds = null) {
    let newMessages = 0;
    try {
      const creds = metaService.getAccountCredentials(accountCreds);
      const conversations = await metaService.getConversations(15, creds);

      for (const conv of conversations) {
        newMessages += await this.syncSingleConversation(conv, creds);
      }
    } catch (err) {
      console.warn('[InboxSync] Error sincronizando conversaciones:', err.message);
    }
    return { newMessages };
  }

  async syncSingleConversation(conv, creds) {
    let count = 0;
    if (!conv.account_id) conv.account_id = creds.pageId || creds.instagramId || null;
    if (!conv.account_name) conv.account_name = creds.pageName || null;

    upsertConversation(conv);

    const messages = await metaService.getConversationMessages(conv.id, conv.platform, creds);
    for (const msg of messages) {
      if (!msg.account_id) msg.account_id = conv.account_id;
      const exists = db.prepare('SELECT id, notified_whatsapp FROM inbox_messages WHERE id = ?').get(msg.id);
      if (!exists) {
        upsertInboxMessage(msg);
        if (msg.sender_type === 'customer') {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Sincroniza comentarios de publicaciones recientes
   */
  async syncComments(accountCreds = null) {
    let newComments = 0;
    try {
      const creds = metaService.getAccountCredentials(accountCreds);
      const comments = await metaService.getRecentComments(25, creds);

      for (const c of comments) {
        if (!c.account_id) c.account_id = creds.pageId || null;
        if (!c.account_name) c.account_name = creds.pageName || null;

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

  async dispatchPendingDMs(config) {
    let sent = 0;
    if (!config.notifyDms) {
      db.prepare("UPDATE inbox_messages SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      return sent;
    }

    const unnotifiedMsgs = getUnnotifiedMessages();
    for (const msg of unnotifiedMsgs) {
      try {
        const conv = msg.conversation_id ? db.prepare('SELECT account_name FROM inbox_conversations WHERE id = ?').get(msg.conversation_id) : null;
        const accName = conv?.account_name || '';
        console.log(`[InboxSync] 📱 Enviando notificación WhatsApp para DM de "${msg.sender_name || 'Cliente'}" (${msg.platform})...`);
        await whatsappService.notifyDirectMessage({
          accountName: accName,
          senderName: msg.sender_name || 'Cliente',
          messageText: msg.message_text,
          platform: msg.platform
        });
        markMessageNotified(msg.id);
        sent++;
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        console.error(`[InboxSync] Error notificando mensaje ${msg.id} a WhatsApp:`, err.message);
        markMessageNotified(msg.id);
      }
    }
    return sent;
  }

  async dispatchPendingComments(config) {
    let sent = 0;
    if (!config.notifyComments) {
      db.prepare("UPDATE inbox_comments SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      return sent;
    }

    const unnotifiedComments = getUnnotifiedComments();
    for (const c of unnotifiedComments) {
      try {
        console.log(`[InboxSync] 📱 Enviando notificación WhatsApp para comentario de "${c.from_name || 'Usuario'}" (${c.platform})...`);
        await whatsappService.notifyComment({
          accountName: c.account_name || '',
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
    return sent;
  }

  /**
   * Revisa mensajes y comentarios nuevos sin notificar y envía el WhatsApp
   */
  async dispatchPendingWhatsAppNotifications() {
    let sent = 0;
    const config = whatsappService.getConfig();

    // Si el usuario desactivó explícitamente las alertas, marcar como no pendientes para no acumular spam
    if (!config.enabled) {
      db.prepare("UPDATE inbox_messages SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      db.prepare("UPDATE inbox_comments SET notified_whatsapp = 1 WHERE notified_whatsapp = 0").run();
      return { sent: 0, reason: 'Notificaciones de WhatsApp desactivadas por el usuario' };
    }

    // Si están activadas pero faltan credenciales (teléfono, token de Green-API o API key de CallMeBot)
    if (!whatsappService.isConfigured()) {
      console.warn('[InboxSync] Notificaciones de WhatsApp habilitadas pero faltan credenciales o teléfono configurado. No se marcan como leídos.');
      return { sent: 0, reason: 'Faltan credenciales o número de WhatsApp' };
    }

    sent += await this.dispatchPendingDMs(config);
    sent += await this.dispatchPendingComments(config);

    return { sent };
  }
}

module.exports = new InboxSyncService();
