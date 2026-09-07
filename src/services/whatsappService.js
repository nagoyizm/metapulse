const axios = require('axios');
const { getSetting } = require('../database/db');

class WhatsAppService {
  /**
   * Obtiene la configuración de WhatsApp desde la base de datos
   */
  getConfig() {
    return {
      enabled: getSetting('whatsapp_notifications_enabled') === 'true' || process.env.WHATSAPP_NOTIFICATIONS_ENABLED === 'true',
      phone: (getSetting('whatsapp_phone') || process.env.WHATSAPP_PHONE || '').trim(),
      apiKey: (getSetting('whatsapp_api_key') || process.env.CALLMEBOT_API_KEY || '').trim(),
      serviceType: getSetting('whatsapp_service_type') || process.env.WHATSAPP_SERVICE_TYPE || 'green-api',
      greenIdInstance: (getSetting('whatsapp_green_id_instance') || process.env.GREEN_ID_INSTANCE || '').trim(),
      greenApiToken: (getSetting('whatsapp_green_api_token') || process.env.GREEN_API_TOKEN || '').trim(),
      notifyDms: getSetting('whatsapp_notify_dms') !== 'false',
      notifyComments: getSetting('whatsapp_notify_comments') !== 'false',
      publicUrl: (getSetting('public_url_base') || process.env.PUBLIC_URL_BASE || '').trim() || 'http://37.60.235.111:3000'
    };
  }

  /**
   * Normaliza el teléfono para formato internacional
   */
  normalizePhone(phone, forGreenApi = false) {
    if (!phone) return '';
    const digitsOnly = phone.replace(/[^0-9]/g, '');
    if (forGreenApi) {
      return digitsOnly;
    }
    return '+' + digitsOnly;
  }

  /**
   * Envía mensaje usando Green-API (instancia propia de WhatsApp)
   */
  async sendViaGreenApi(idInstance, apiToken, phone, text) {
    const cleanPhone = this.normalizePhone(phone, true);
    if (!idInstance || !apiToken || !cleanPhone) {
      throw new Error('Faltan el ID de Instancia, el Token de Green-API o tu número de teléfono.');
    }

    const chatId = `${cleanPhone}@c.us`;
    // Green-API utiliza subdominios dedicados por host de instancia (ej: https://7105.api.greenapi.com)
    const hostPrefix = idInstance.length >= 4 ? idInstance.slice(0, 4) : '';
    const baseUrl = hostPrefix ? `https://${hostPrefix}.api.greenapi.com` : 'https://api.green-api.com';
    const url = `${baseUrl}/waInstance${idInstance}/sendMessage/${apiToken}`;

    try {
      const response = await axios.post(
        url,
        { chatId, message: text },
        { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data || err.message;
      console.error('[WhatsAppService:GreenAPI] Error:', errorMsg);
      throw new Error(`Error en Green-API: ${JSON.stringify(errorMsg)}`);
    }
  }

  /**
   * Envía mensaje usando CallMeBot
   */
  async sendViaCallMeBot(phone, apiKey, text) {
    const targetPhone = this.normalizePhone(phone, false);
    if (!targetPhone || !apiKey) {
      throw new Error('Faltan el número de teléfono o la API Key de CallMeBot.');
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(targetPhone)}&text=${encodedText}&apikey=${encodeURIComponent(apiKey)}`;

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'MetaPulse-Social-Suite/1.0' }
      });

      const dataStr = String(response.data || '');
      if (dataStr.toLowerCase().includes('error') && !dataStr.toLowerCase().includes('success')) {
        throw new Error(`Respuesta de CallMeBot: ${dataStr}`);
      }

      return { success: true, data: dataStr };
    } catch (err) {
      const msg = err.response?.data ? String(err.response.data) : err.message;
      console.error('[WhatsAppService:CallMeBot] Error:', msg);
      throw new Error(`Fallo al enviar WhatsApp vía CallMeBot: ${msg}`);
    }
  }

  /**
   * Despacha el mensaje según el proveedor activo (Green-API o CallMeBot)
   */
  async dispatchMessage(text, customOpts = {}) {
    const config = this.getConfig();
    const service = customOpts.serviceType || config.serviceType || (config.greenIdInstance ? 'green-api' : 'callmebot');
    const phone = customOpts.phone || config.phone;

    if (service === 'green-api') {
      const idInstance = customOpts.greenIdInstance || config.greenIdInstance;
      const apiToken = customOpts.greenApiToken || config.greenApiToken;
      return await this.sendViaGreenApi(idInstance, apiToken, phone, text);
    } else {
      const apiKey = customOpts.apiKey || config.apiKey;
      return await this.sendViaCallMeBot(phone, apiKey, text);
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

    const platformLabel = platform === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct';
    const text = 
`🔔 *[MetaPulse] Nuevo Mensaje en ${platformLabel}*
👤 *De:* ${senderName || 'Usuario'}
💬 *Mensaje:* "${(messageText || '').slice(0, 160)}"

👉 *Responder en:* ${config.publicUrl}/#inbox`;

    return await this.dispatchMessage(text);
  }

  /**
   * Notifica la llegada de un nuevo comentario en una publicación
   */
  async notifyComment({ authorName, commentText, postCaption, platform = 'instagram' }) {
    const config = this.getConfig();
    if (!config.enabled || !config.notifyComments) {
      return { skipped: true, reason: 'Notificaciones de comentarios desactivadas' };
    }

    const platformLabel = platform === 'facebook' ? 'Facebook' : 'Instagram';
    const postSnippet = postCaption ? `\n📌 *Post:* "${postCaption.slice(0, 45)}..."` : '';
    const text = 
`💬 *[MetaPulse] Nuevo Comentario en ${platformLabel}*
👤 *Autor:* ${authorName || 'Usuario'}${postSnippet}
✍️ *Comentario:* "${(commentText || '').slice(0, 160)}"

👉 *Responder en:* ${config.publicUrl}/#inbox`;

    return await this.dispatchMessage(text);
  }

  /**
   * Envía un mensaje de prueba
   */
  async sendTestMessage(customParams = {}) {
    const config = this.getConfig();
    const service = customParams.serviceType || config.serviceType || 'green-api';
    const phone = customParams.phone || config.phone;

    if (!phone) {
      throw new Error('Debes ingresar un número de teléfono para recibir la alerta.');
    }

    const testText = 
`🚀 *[MetaPulse] ¡Conexión Exitosa con WhatsApp!*

Tu servidor en *${config.publicUrl}* está listo y conectado mediante *${service === 'green-api' ? 'Green-API' : 'CallMeBot'}*.

Recibirás alertas en tiempo real de:
• ✉️ Mensajes Directos (Instagram DMs & Messenger)
• 💬 Comentarios en tus publicaciones

¡Todo funcionando correctamente! ⚡`;

    return await this.dispatchMessage(testText, { ...customParams, phone, serviceType: service });
  }
}

module.exports = new WhatsAppService();
