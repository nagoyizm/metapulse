const cron = require('node-cron');
const metaService = require('./metaService');
const { getSetting } = require('../database/db');

class MetricsSyncService {
  cronTask = null;

  start() {
    console.log('📊 Iniciando servicio de sincronización diaria de métricas de posts (cron: 17 4 * * *)...');
    this.cronTask = cron.schedule('17 4 * * *', async () => {
      await this.syncAll().catch(err => {
        console.warn('[MetricsSync] Error general en sincronización programada:', err.message);
      });
    });
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }

  async syncAll() {
    let accounts = [];
    try {
      const cachedStr = getSetting('cached_managed_accounts');
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (Array.isArray(parsed)) {
          accounts = parsed;
        }
      }
    } catch (err) {
      console.warn('[MetricsSync] No se pudo leer cached_managed_accounts:', err.message);
    }

    if (accounts.length === 0) {
      const mainConfig = metaService.getConfig();
      if (mainConfig.pageId && (mainConfig.instagramId || mainConfig.pageToken)) {
        accounts = [{
          pageId: mainConfig.pageId,
          pageName: mainConfig.pageName,
          pageToken: mainConfig.pageToken,
          instagram: mainConfig.instagramId ? { id: mainConfig.instagramId, username: mainConfig.instagramUsername } : null
        }];
      }
    }

    let totalSaved = 0;
    let accountsSynced = 0;

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const hasInstagram = Boolean(account.instagram && account.instagram.id) || Boolean(account.instagramId);
      if (!hasInstagram) {
        continue;
      }

      try {
        const posts = await metaService.getLiveInstagramPosts(50, account);
        const pageId = account.pageId || account.id || '';
        const pageName = account.pageName || account.name || '';
        const saved = metaService.upsertPostMetrics(posts, { accountId: pageId, accountName: pageName });
        totalSaved += (Number(saved) || 0);
        accountsSynced++;
      } catch (err) {
        console.warn(`[MetricsSync] Advertencia sincronizando cuenta ${account.pageName || account.pageId}:`, err.message);
      }

      // Pausa aleatoria de 2-4 s entre cuentas
      if (i < accounts.length - 1) {
        const delayMs = 2000 + Math.floor(Math.random() * 2001);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[MetricsSync] Sincronización finalizada: ${totalSaved} métricas actualizadas en ${accountsSynced} cuentas.`);
    return { totalSaved, accountsSynced };
  }
}

module.exports = new MetricsSyncService();
