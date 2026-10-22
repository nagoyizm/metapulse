// Vigila los me gusta y comentarios de los posts de Instagram: compara los totales cada pocos minutos y
// registra los aumentos como eventos (alimentan el feed de la pestaña "Actividad").
// Meta no entrega QUIÉN dio me gusta ni cuándo: solo el total, así que los eventos son "+N desde la última revisión".
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const metaService = require('./metaService');
const { db, getSetting } = require('../database/db');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const MIN_MANUAL_GAP_MS = 60 * 1000;
const EVENT_RETENTION_DAYS = 90;

let cronTask = null;
let running = false;
let lastRunAt = 0;

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS engagement_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meta_media_id TEXT NOT NULL,
      account_id TEXT,
      account_name TEXT,
      kind TEXT NOT NULL,            -- 'likes' | 'comments'
      delta INTEGER NOT NULL,
      total INTEGER NOT NULL,
      caption TEXT,
      permalink TEXT,
      thumb_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_engagement_events_created ON engagement_events (id DESC);
  `);
  try { db.prepare('ALTER TABLE post_metrics ADD COLUMN thumb_url TEXT').run(); } catch (_) { /* ya existe */ }
  for (const col of ['author TEXT', 'text TEXT', 'comment_id TEXT', 'event_time TEXT']) {
    try { db.prepare('ALTER TABLE engagement_events ADD COLUMN ' + col).run(); } catch (_) { /* ya existe */ }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_comment_id ON engagement_events (comment_id) WHERE comment_id IS NOT NULL');
}

function loadAccounts() {
  let accounts = [];
  try {
    const parsed = JSON.parse(getSetting('cached_managed_accounts') || '[]');
    if (Array.isArray(parsed)) accounts = parsed;
  } catch (_) { accounts = []; }
  if (accounts.length === 0) {
    const c = metaService.getConfig();
    if (c.pageId && (c.instagramId || c.pageToken)) {
      accounts = [{ pageId: c.pageId, pageName: c.pageName, pageToken: c.pageToken, instagram: c.instagramId ? { id: c.instagramId } : null }];
    }
  }
  return accounts.filter(a => (a.instagram && a.instagram.id) || a.instagramId);
}

async function ensureThumb(post, existing) {
  const current = existing && existing.thumb_url;
  if (current && fs.existsSync(path.join(UPLOADS_DIR, current.replace(/^\/uploads\//, '')))) return current;
  const remote = post.thumbnail_url || post.media_url;
  if (!remote) return current || null;
  try {
    const local = await metaService.cacheRemoteMedia(remote, post.id);
    return local || current || null;
  } catch (_) { return current || null; }
}

async function checkAccount(account) {
  const accountId = account.pageId || account.id || '';
  const accountName = account.pageName || account.name || '';
  const posts = await metaService.getLiveInstagramPosts(30, account);
  const getPrev = db.prepare('SELECT likes, comments, thumb_url FROM post_metrics WHERE meta_media_id = ?');
  const addEvent = db.prepare(`
    INSERT INTO engagement_events (meta_media_id, account_id, account_name, kind, delta, total, caption, permalink, thumb_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addComment = db.prepare(`
    INSERT OR IGNORE INTO engagement_events (meta_media_id, account_id, account_name, kind, delta, total, caption, permalink, thumb_url, author, text, comment_id, event_time)
    VALUES (?, ?, ?, 'comment', 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let events = 0;
  for (const p of posts) {
    if (!p || !p.id) continue;
    const likes = Number(p.like_count) || 0;
    const comments = Number(p.comments_count) || 0;
    const prev = getPrev.get(p.id);
    const thumb = await ensureThumb(p, prev);
    if (prev) {
      // Solo se registran aumentos; las bajas (alguien quitó su me gusta) se actualizan sin evento
      if (likes > prev.likes) { addEvent.run(p.id, accountId, accountName, 'likes', likes - prev.likes, likes, p.caption || '', p.permalink || '', thumb); events++; }
      if (comments > prev.comments) {
        const delta = comments - prev.comments;
        let found = 0;
        try {
          const list = (await getMediaComments(p.id, account))
            .filter(c => c && c.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, delta);
          for (const c of list) {
            const r = addComment.run(p.id, accountId, accountName, comments, p.caption || '', p.permalink || '', thumb, c.username || '', c.text || '', c.id, c.timestamp || null);
            if (r.changes > 0) { found++; events++; }
          }
        } catch (e) {
          console.warn('[Engagement] No se pudieron leer los comentarios de', p.id, e.message);
        }
        // Lo que no se pudo detallar (respuestas, fallo de lectura) queda como conteo
        const rest = delta - found;
        if (rest > 0 && found === 0) { addEvent.run(p.id, accountId, accountName, 'comments', rest, comments, p.caption || '', p.permalink || '', thumb); events++; }
      }
    }
    // Primera vez que se ve el post: se guarda como base, sin evento
    metaService.upsertPostMetrics([p], { accountId, accountName });
    db.prepare('UPDATE post_metrics SET thumb_url = ? WHERE meta_media_id = ?').run(thumb, p.id);
  }
  return events;
}

async function checkAll({ manual = false } = {}) {
  if (running) return { skipped: 'en curso' };
  if (manual && Date.now() - lastRunAt < MIN_MANUAL_GAP_MS) return { skipped: 'reciente' };
  running = true;
  let events = 0;
  try {
    for (const account of loadAccounts()) {
      try { events += await checkAccount(account); } catch (e) {
        console.warn('[Engagement] Error en cuenta', account.pageName || account.pageId, e.message);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    db.prepare(`DELETE FROM engagement_events WHERE created_at < datetime('now', ?)`).run(`-${EVENT_RETENTION_DAYS} days`);
  } finally {
    lastRunAt = Date.now();
    running = false;
  }
  return { events };
}

// Comentarios de un post de Instagram, en vivo desde Meta
async function getMediaComments(mediaId, accountOrId) {
  const axios = require('axios');
  const creds = metaService.getAccountCredentials(accountOrId || null);
  if (!creds || !creds.pageToken) throw new Error('La cuenta no tiene token de Instagram.');
  const res = await axios.get(`${metaService.graphUrl}/${encodeURIComponent(mediaId)}/comments`, {
    params: { fields: 'id,text,timestamp,username,like_count', limit: 50, access_token: creds.pageToken },
    timeout: 15000
  });
  return (res.data && res.data.data) || [];
}

function start() {
  ensureSchema();
  // Cada 5 minutos (hay que respetar los límites de la API de Meta)
  cronTask = cron.schedule('*/5 * * * *', () => {
    checkAll().catch(e => console.warn('[Engagement] Error en revisión:', e.message));
  });
  setTimeout(() => checkAll().catch(() => {}), 20000);
  console.log('❤️ Vigilancia de me gusta y comentarios activa (cada 5 min).');
}

function stop() { if (cronTask) { cronTask.stop(); cronTask = null; } }

module.exports = { start, stop, checkAll, ensureSchema, loadAccounts, getMediaComments };
