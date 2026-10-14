// Memoria de contenido: evita que la IA repita aperturas, cierres y hashtags de los últimos posts.
const crypto = require('node:crypto');
const { db, getSetting } = require('../database/db');
const COPY_RULES = require('../config/copyRules');

const HASHTAG_LINE = /^(\s*#[^\s#]+)+\s*$/u;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class ContentMemoryService {
  // Últimos captions (más recientes primero) de la cuenta, por nombre parcial o id.
  getRecentCaptions({ accountName = '', accountId = '', limit = 15 } = {}) {
    const name = (accountName || '').trim();
    const id = accountId || (!name ? (getSetting('meta_page_id') || '') : '');
    if (!name && !id) return [];
    try {
      const rows = db.prepare(`
        SELECT content FROM posts
        WHERE content IS NOT NULL AND content != ''
          AND status IN ('published', 'scheduled', 'processing')
          AND (${name ? "LOWER(account_name) LIKE '%' || LOWER(?) || '%'" : '0'} OR ${id ? 'account_id = ?' : '0'})
        ORDER BY COALESCE(published_at, scheduled_at, created_at) DESC
        LIMIT ?
      `).all(...[name, id].filter(Boolean), limit);
      return rows.map(r => r.content);
    } catch (err) {
      console.warn('[contentMemory] No se pudo leer posts recientes:', err.message);
      return [];
    }
  }

  splitCaption(text) {
    const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
    const body = lines.filter(l => !HASHTAG_LINE.test(l));
    return {
      opening: body[0] || '',
      closing: body.length > 1 ? body[body.length - 1] : '',
      hashtags: (String(text).match(/#[^\s#]+/gu) || [])
    };
  }

  buildMemoryBlock(captions = []) {
    if (!captions.length) return '';
    const parts = captions.slice(0, 15).map(c => this.splitCaption(c));
    const openings = [...new Set(parts.map(p => p.opening).filter(Boolean))].slice(0, 15);
    const closings = [...new Set(parts.map(p => p.closing).filter(Boolean))].slice(0, 10);
    return [
      'MEMORIA DE LA CUENTA (lo que ya se publicó; NO lo repitas):',
      'Aperturas recientes:',
      ...openings.map(o => `- ${o}`),
      closings.length ? 'Cierres recientes:' : '',
      ...closings.map(c => `- ${c}`),
      'Escribe una apertura y un cierre con palabras y estructura distintas a todas las anteriores. Varía también el largo del post respecto a los últimos.'
    ].filter(Boolean).join('\n');
  }

  // 3-5 hashtags: siempre los core + rotación del banco, evitando repetir el set del último post.
  pickHashtags(profile, recentCaptions = []) {
    const core = profile.hashtagCore || [];
    const bank = (profile.hashtagBank || []).filter(t => !core.includes(t));
    const lastSet = recentCaptions.length ? this.splitCaption(recentCaptions[0]).hashtags : [];
    const target = Math.min(COPY_RULES.HASHTAGS_MAX, Math.max(COPY_RULES.HASHTAGS_MIN, core.length + crypto.randomInt(1, 4)));
    const fresh = shuffle(bank.filter(t => !lastSet.includes(t)));
    const used = shuffle(bank.filter(t => lastSet.includes(t)));
    return [...core, ...fresh, ...used].slice(0, target);
  }
}

module.exports = new ContentMemoryService();
