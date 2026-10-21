const fs = require('fs');
const path = require('path');
const { db, getSetting } = require('../database/db');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
// Carpetas con archivos que la app genera sola. NO se tocan los archivos sueltos de uploads/ (biblioteca del usuario),
// ni watermarks/ (sellos), ni el audio subido a mano.
const GENERATED_DIRS = ['stories', 'processed', 'generated', 'meta_cache', 'audio/cache'];
const DEFAULT_RETENTION_DAYS = 60;
const MIN_RETENTION_DAYS = 3;
const AUDIO_CACHE_MIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function getRetentionDays() {
  let raw;
  try { raw = getSetting('media_retention_days'); } catch (_) { raw = null; }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(365, Math.max(MIN_RETENTION_DAYS, n));
}

// "/uploads/stories/a.mp4", "https://host/uploads/stories/a.mp4?x=1" -> "stories/a.mp4"
function toRelUploads(url) {
  if (!url || typeof url !== 'string') return null;
  let p = url;
  try { if (/^https?:\/\//i.test(p)) p = new URL(p).pathname; } catch (_) { return null; }
  p = p.split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch (_) { /* se deja tal cual */ }
  const i = p.indexOf('/uploads/');
  if (i < 0) return null;
  return p.slice(i + '/uploads/'.length).replace(/\\/g, '/').toLowerCase();
}

function addUrls(set, value) {
  let arr = [];
  try { arr = Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch (_) { arr = []; }
  for (const u of arr) {
    const rel = toRelUploads(typeof u === 'string' ? u : (u && u.url));
    if (rel) set.add(rel);
  }
}

// Archivos que siguen en uso: medios de borradores, agendados, en proceso, fallidos y de lo publicado/cancelado
// hace menos de `days` días, más todo lo que está en la biblioteca (media_items).
function collectProtected(days) {
  const prot = new Set();
  const cutoff = new Date(Date.now() - days * DAY_MS).toISOString();
  const rows = db.prepare(`
    SELECT media_urls FROM posts
    WHERE status IN ('draft', 'scheduled', 'processing', 'failed')
       OR COALESCE(published_at, updated_at, created_at, '') >= ?
  `).all(cutoff.slice(0, 19).replace('T', ' '));
  for (const r of rows) addUrls(prot, r.media_urls);
  // Por seguridad también por ISO (scheduled_at se guarda en ISO)
  const rows2 = db.prepare(`SELECT media_urls FROM posts WHERE scheduled_at >= ?`).all(cutoff);
  for (const r of rows2) addUrls(prot, r.media_urls);
  for (const r of db.prepare('SELECT filepath FROM media_items').all()) {
    const rel = toRelUploads(r.filepath);
    if (rel) prot.add(rel);
  }
  return prot;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) continue; // sin recursión: solo archivos directos de cada carpeta
    out.push(full);
  }
  return out;
}

/**
 * Borra los archivos generados que ya no se usan y superan el tiempo de vida.
 * @param {{dryRun?: boolean}} opts
 * @returns {{days:number, dryRun:boolean, deleted:number, freedBytes:number, kept:number, files:Array}}
 */
function runCleanup({ dryRun = false } = {}) {
  const days = getRetentionDays();
  const protectedSet = collectProtected(days);
  const now = Date.now();
  const result = { days, dryRun, deleted: 0, freedBytes: 0, kept: 0, files: [] };

  for (const sub of GENERATED_DIRS) {
    const isAudioCache = sub === 'audio/cache';
    const maxAgeMs = (isAudioCache ? Math.max(days, AUDIO_CACHE_MIN_DAYS) : days) * DAY_MS;
    for (const full of walk(path.join(UPLOADS_DIR, sub))) {
      let st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      const rel = path.relative(UPLOADS_DIR, full).replace(/\\/g, '/').toLowerCase();
      const ageMs = now - st.mtimeMs;
      // La caché de audio no está referenciada por URL: solo cuenta la antigüedad.
      const inUse = !isAudioCache && protectedSet.has(rel);
      if (inUse || ageMs < maxAgeMs) {
        result.kept++;
        continue;
      }
      result.files.push({ file: rel, mb: Math.round(st.size / 1048576 * 10) / 10, days: Math.floor(ageMs / DAY_MS) });
      result.freedBytes += st.size;
      result.deleted++;
      if (!dryRun) {
        try { fs.unlinkSync(full); } catch (e) { console.warn('[MediaCleanup] No se pudo borrar', rel, e.message); }
      }
    }
  }
  if (!dryRun && result.deleted > 0) {
    console.log(`[MediaCleanup] Borrados ${result.deleted} archivos (${Math.round(result.freedBytes / 1048576)} MB) con más de ${days} días sin uso.`);
  }
  return result;
}

// Ejecuta la limpieza una vez al día, de madrugada (hora de Chile).
function startDailyCleanup() {
  let lastRunDay = null;
  const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: 'numeric', hour12: false });
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });
  const tick = () => {
    const now = new Date();
    const h = Number(hourFmt.format(now)) % 24;
    const day = dayFmt.format(now);
    if (h === 4 && lastRunDay !== day) {
      lastRunDay = day;
      try { runCleanup(); } catch (e) { console.warn('[MediaCleanup] Error en limpieza diaria:', e.message); }
    }
  };
  setInterval(tick, 20 * 60 * 1000).unref?.();
}

module.exports = { runCleanup, startDailyCleanup, getRetentionDays };
