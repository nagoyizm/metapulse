const axios = require('axios');
const { getSetting } = require('../database/db');

class WhatsAppService {
  /**
   * Obtiene la configuración de WhatsApp desde la base de datos
   */
  getConfig() {
    return {
      enabled: getSetting('whatsapp_notifications_enabled') === 'true',
      phone: (getSetting('whatsapp_phone') || '').trim(),
      apiKey: (getSetting('whatsapp_api_key') || '').trim(),
      notifyDms: getSetting('whatsapp_notify_dms') !== 'false',
      notifyComments: getSetting('whatsapp_notify_comments') !== 'false',
      serviceType: getSetting('whatsapp_service_type') || 'callmebot',
      publicUrl: (getSetting('public_url_base') || '').trim() || 'http://37.60.235.111:3000'
    };
  }

  /**
   * Normaliza el número de teléfono para CallMeBot
   * Acepta formatos como "+56 9 1234 5678", "56912345678", etc.
   */
  normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    if (!cleaned.startsWith('+') && !cleaned.startsWith('00')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  /**
   * Envía un mensaje de texto plano vía CallMeBot
   */
  async sendMessage(phone, apiKey, text) {
    const targetPhone = this.normalizePhone(phone);
    if (!targetPhone || !apiKey) {
      throw new Error('Faltan el número de teléfono o la API Key de WhatsApp/CallMeBot.');
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(targetPhone)}&text=${encodedText}&apikey=${encodeURIComponent(apiKey)}`;

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MetaPulse-Social-Suite/1.0'
        }
      });

      // CallMeBot devuelve texto HTML o plano confirmando el envío
      const dataStr = String(response.data || '');
      if (dataStr.toLowerCase().includes('error') && !dataStr.toLowerCase().includes('success')) {
        throw new Error(`Respuesta de CallMeBot: ${dataStr}`);
      }

      return {
        success: true,
        data: dataStr
      };
    } catch (err) {
      const msg = err.response?.data ? String(err.response.data) : err.message;
      console.error('[WhatsAppService] Error enviando mensaje:', msg);
      throw new Error(`Fallo al enviar WhatsApp: ${msg}`);
    }
  }

  /**
   * Notifica la llegada de un nuevo mensaje directo (DM)
   */
  async notifyDirectMessage({ senderName, messageText, platform = 'instagram' }) {
    const config = this.getConfig();
    if (!config.enabled || !config.notifyDms) {
      return { skipped: true, reason: 'Notificaciones de DMs desactivadas' };
    }
    if (!config.phone || !config.apiKey) {
      return { skipped: true, reason: 'Teléfono o API Key no configurados' };
    }

    const platformLabel = platform === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct';
    const text = 
`🔔 *[MetaPulse] Nuevo Mensaje en ${platformLabel}*
👤 *De:* ${senderName || 'Usuario'}
💬 *Mensaje:* "${(messageText || '').slice(0, 160)}"

👉 *Responder en:* ${config.publicUrl}/#inbox`;

    return await this.sendMessage(config.phone, config.apiKey, text);
  }

  /**
   * Notifica la llegada de un nuevo comentario en una publicación
   */
  async notifyComment({ authorName, commentText, postCaption, platform = 'instagram' }) {
    const config = this.getConfig();
    if (!config.enabled || !config.notifyComments) {
      return { skipped: true, reason: 'Notificaciones de comentarios desactivadas' };
    }
    if (!config.phone || !config.apiKey) {
      return { skipped: true, reason: 'Teléfono o API Key no configurados' };
    }

    const platformLabel = platform === 'facebook' ? 'Facebook' : 'Instagram';
    const postSnippet = postCaption ? `\n📌 *Post:* "${postCaption.slice(0, 45)}..."` : '';
    const text = 
`💬 *[MetaPulse] Nuevo Comentario en ${platformLabel}*
👤 *Autor:* ${authorName || 'Usuario'}${postSnippet}
✍️ *Comentario:* "${(commentText || '').slice(0, 160)}"

👉 *Responder en:* ${config.publicUrl}/#inbox`;

    return await this.sendMessage(config.phone, config.apiKey, text);
  }

  /**
   * Envía un mensaje de prueba al teléfono configurado para validar la integración
   */
  async sendTestMessage(customPhone, customApiKey) {
    const config = this.getConfig();
    const phone = customPhone || config.phone;
    const apiKey = customApiKey || config.apiKey;

    if (!phone || !apiKey) {
      throw new Error('Debes ingresar un número de teléfono y tu API Key para enviar la prueba.');
    }

    const testText = 
`🚀 *[MetaPulse] ¡Conexión Exitosa con WhatsApp!*

Tu servidor en *${config.publicUrl}* está listo para enviarte alertas en tiempo real de:
• ✉️ Mensajes Directos (Instagram DMs & Messenger)
• 💬 Comentarios en tus publicaciones

¡Todo configurado correctamente! ⚡`;

    return await this.sendMessage(phone, apiKey, testText);
  }
}

module.exports = new WhatsAppService();
