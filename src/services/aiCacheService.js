const crypto = require('crypto');
const { getAiCache, setAiCache, cleanExpiredAiCache } = require('../database/db');

class AICacheService {
  constructor() {
    this.l1Cache = new Map(); // key -> { value, expiresAt }
    this.maxL1Size = 300;
    this.stats = {
      hitsL1: 0,
      hitsL2: 0,
      misses: 0,
      writes: 0
    };

    // Limpieza periódica cada 30 minutos
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 30 * 60 * 1000).unref?.();
    }
  }

  /**
   * Genera una clave hash determinista basada en el namespace y los parámetros ordenados
   */
  generateKey(namespace, params = {}) {
    const normalize = (obj) => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(normalize);
      }
      return Object.keys(obj)
        .sort()
        .reduce((acc, k) => {
          if (obj[k] !== undefined) {
            acc[k] = normalize(obj[k]);
          }
          return acc;
        }, {});
    };

    const serialized = JSON.stringify(normalize(params));
    const hash = crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 32);
    return `${namespace}:${hash}`;
  }

  /**
   * Obtiene un valor de la caché (L1 en memoria primero, luego L2 en SQLite)
   */
  get(key) {
    if (!key) return { hit: false, tier: null, data: null };

    // 1. Verificar L1 (Memoria RAM ultrarrápida)
    if (this.l1Cache.has(key)) {
      const item = this.l1Cache.get(key);
      if (Date.now() < item.expiresAt) {
        // Renovar posición LRU
        this.l1Cache.delete(key);
        this.l1Cache.set(key, item);
        this.stats.hitsL1++;
        return { hit: true, tier: 'L1', data: item.value };
      } else {
        this.l1Cache.delete(key);
      }
    }

    // 2. Verificar L2 (SQLite persistente)
    try {
      const row = getAiCache(key);
      if (row && row.response) {
        let parsed = null;
        try {
          parsed = JSON.parse(row.response);
        } catch (_) {
          parsed = row.response;
        }

        // Calentar L1
        const expiresAtMs = new Date(row.expires_at).getTime();
        if (expiresAtMs > Date.now()) {
          this.setL1(key, parsed, expiresAtMs);
        }

        this.stats.hitsL2++;
        return {
          hit: true,
          tier: 'L2',
          data: parsed,
          provider: row.provider,
          model: row.model
        };
      }
    } catch (err) {
      console.warn('[AICacheService] Error leyendo L2 cache:', err.message);
    }

    this.stats.misses++;
    return { hit: false, tier: null, data: null };
  }

  /**
   * Guarda un valor en L1 y L2
   */
  set(key, value, ttlSeconds = 43200, provider = 'gemini', model = 'gemini-2.5-flash') {
    if (!key || value === undefined || value === null) return;

    const expiresAtMs = Date.now() + (ttlSeconds * 1000);
    const expiresAtIso = new Date(expiresAtMs).toISOString();

    // Guardar L1
    this.setL1(key, value, expiresAtMs);

    // Guardar L2
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      setAiCache(key, provider, model, serialized, expiresAtIso);
      this.stats.writes++;
    } catch (err) {
      console.warn('[AICacheService] Error escribiendo L2 cache:', err.message);
    }
  }

  /**
   * Almacenamiento interno L1 con desalojo LRU
   */
  setL1(key, value, expiresAtMs) {
    if (this.l1Cache.size >= this.maxL1Size) {
      const oldestKey = this.l1Cache.keys().next().value;
      if (oldestKey) this.l1Cache.delete(oldestKey);
    }
    this.l1Cache.set(key, { value, expiresAt: expiresAtMs });
  }

  /**
   * Invalida una clave específica
   */
  delete(key) {
    this.l1Cache.delete(key);
    try {
      const { db } = require('../database/db');
      db.prepare('DELETE FROM ai_cache WHERE key = ?').run(key);
    } catch (_) {}
  }

  /**
   * Limpia registros vencidos en memoria y SQLite
   */
  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.l1Cache.entries()) {
      if (v.expiresAt <= now) {
        this.l1Cache.delete(k);
      }
    }
    try {
      cleanExpiredAiCache();
    } catch (_) {}
  }

  /**
   * Métricas y estado actual
   */
  getStats() {
    return {
      ...this.stats,
      l1Size: this.l1Cache.size,
      maxL1Size: this.maxL1Size,
      hitRate: (this.stats.hitsL1 + this.stats.hitsL2) / Math.max(1, (this.stats.hitsL1 + this.stats.hitsL2 + this.stats.misses))
    };
  }
}

module.exports = new AICacheService();
