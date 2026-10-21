const { db, getSetting } = require('../database/db');

// Separación mínima entre dos historias de la misma cuenta.
const MIN_GAP_MS = 90 * 60 * 1000;
// Una historia dura 24 h: la misma historia no puede repetirse antes de eso o se ven dos a la vez.
const SAME_STORY_GAP_MS = 25 * 60 * 60 * 1000;
// Ventana en la que se cuenta cuántas historias hay "a la vez" (lo que dura una historia).
const WINDOW_MS = 24 * 60 * 60 * 1000;
const STEP_MS = 30 * 60 * 1000;
const DAY_START_H = 8;
const DAY_END_H = 23;
const DEFAULT_MAX_PER_24H = 3;

// Máximo de historias de una cuenta dentro de cualquier ventana de 24 h (ajuste `max_stories_per_24h`).
function getMaxPer24h() {
  let raw;
  try { raw = getSetting('max_stories_per_24h'); } catch (_) { raw = null; }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_MAX_PER_24H;
  return Math.min(20, Math.max(1, n));
}

function acctClause(accountId) {
  return accountId ? { sql: 'account_id = ?', params: [accountId] } : { sql: 'account_id IS NULL', params: [] };
}

// Clave del contenido de la historia: el título sin el prefijo "[Historia 2/8 • ...]:" ni "Story:".
function storyKey(title) {
  return String(title || '').replace(/^(\[[^\]]*\]|Story):\s*/, '').trim().toLowerCase();
}

// ¿Poner una historia en t deja más de `max` historias dentro de alguna ventana de 24 h?
function overWindowLimit(t, taken, max) {
  const times = taken.map(o => o.t).concat(t).sort((a, b) => a - b);
  for (const s of times) {
    // Solo importan las ventanas [s, s+24h) que contienen a t; las máximas siempre empiezan en una historia.
    if (s > t || s + WINDOW_MS <= t) continue;
    let c = 0;
    for (const x of times) if (x >= s && x < s + WINDOW_MS) c++;
    if (c > max) return true;
  }
  return false;
}

function conflicts(t, key, taken, max) {
  if (taken.some(o => Math.abs(o.t - t) < (o.key === key && key ? SAME_STORY_GAP_MS : MIN_GAP_MS))) return true;
  return overWindowLimit(t, taken, max);
}

const HOUR_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: 'numeric', hour12: false });
function chileHour(ms) {
  return Number(HOUR_FMT.format(new Date(ms))) % 24;
}
function inDayWindow(ms) {
  const h = chileHour(ms);
  return h >= DAY_START_H && h < DAY_END_H;
}

// Busca el horario libre más cercano a t (adelante o atrás, en pasos de 30 min) dentro de 08:00-23:00 hora de Chile.
// Nunca antes de `notBefore` (por defecto, dentro de unos minutos). Prefiere adelante si hay empate.
function nextFree(t, key, taken, max, notBefore) {
  const floor = notBefore != null ? notBefore : Date.now() + 2 * 60 * 1000;
  // Sin choques se respeta el horario pedido tal cual (aunque sea de noche)
  if (!conflicts(t, key, taken, max)) return t;
  const ok = (c) => c >= floor && inDayWindow(c) && !conflicts(c, key, taken, max);
  for (let k = 1; k <= 1500; k++) {
    const fwd = t + k * STEP_MS;
    if (ok(fwd)) return fwd;
    const back = t - k * STEP_MS;
    if (ok(back)) return back;
  }
  return t;
}

// Historias de la cuenta que ya ocupan lugar: agendadas y las publicadas hace menos de 25 h (siguen visibles).
function occupied(accountId) {
  const c = acctClause(accountId);
  const since = new Date(Date.now() - SAME_STORY_GAP_MS).toISOString();
  const rows = db.prepare(`
    SELECT title, scheduled_at FROM posts
    WHERE post_type = 'story' AND scheduled_at IS NOT NULL AND ${c.sql}
      AND (status IN ('scheduled', 'processing') OR (status = 'published' AND scheduled_at > ?))
  `).all(...c.params, since);
  return rows.map(r => ({ t: new Date(r.scheduled_at).getTime(), key: storyKey(r.title) })).filter(o => !isNaN(o.t));
}

// Ajusta una lista [{schedule: ISO, ...}] para que no choque con historias ya agendadas ni entre sí.
// title = título del post de origen (para no repetir la misma historia en menos de 25 h).
// notBefore = ISO opcional: las historias no se mueven antes de esa hora (p. ej. la hora del post del que derivan).
function separateSchedules(items, accountId, title = '', notBefore = null) {
  const key = storyKey(title);
  const max = getMaxPer24h();
  const floorMs = notBefore ? new Date(notBefore).getTime() : null;
  const floor = floorMs != null && !isNaN(floorMs) ? floorMs : null;
  const taken = occupied(accountId);
  return items.map(item => {
    const t = new Date(item.schedule).getTime();
    if (isNaN(t)) return item;
    const free = nextFree(t, key, taken, max, floor);
    taken.push({ t: free, key });
    return free === t ? item : { ...item, schedule: new Date(free).toISOString() };
  });
}

// Reordena las historias ya agendadas: conserva la más antigua de cada choque y mueve las demás.
function repairScheduledStories({ dryRun = false } = {}) {
  const rows = db.prepare(`
    SELECT id, scheduled_at, account_id, title FROM posts
    WHERE post_type = 'story' AND status = 'scheduled' AND scheduled_at > ?
    ORDER BY scheduled_at ASC, id ASC
  `).all(new Date().toISOString());

  // Las ya publicadas en las últimas 25 h también ocupan lugar.
  const recent = db.prepare(`
    SELECT title, scheduled_at, account_id FROM posts
    WHERE post_type = 'story' AND status = 'published' AND scheduled_at > ?
  `).all(new Date(Date.now() - SAME_STORY_GAP_MS).toISOString());

  const max = getMaxPer24h();
  const byAcct = new Map();
  for (const r of rows) {
    const k = r.account_id || '';
    if (!byAcct.has(k)) byAcct.set(k, []);
    byAcct.get(k).push(r);
  }
  const moved = [];
  const upd = db.prepare('UPDATE posts SET scheduled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  for (const [acct, list] of byAcct) {
    const taken = recent
      .filter(r => (r.account_id || '') === acct)
      .map(r => ({ t: new Date(r.scheduled_at).getTime(), key: storyKey(r.title) }));
    for (const r of list) {
      const t = new Date(r.scheduled_at).getTime();
      const key = storyKey(r.title);
      // Al reparar solo se mueve hacia adelante (no se adelantan historias ya agendadas)
      const free = nextFree(t, key, taken, max, t);
      taken.push({ t: free, key });
      if (free !== t) {
        const iso = new Date(free).toISOString();
        moved.push({ id: r.id, title: r.title, from: r.scheduled_at, to: iso });
        if (!dryRun) upd.run(iso, r.id);
      }
    }
  }
  return moved;
}

module.exports = { separateSchedules, repairScheduledStories, storyKey, getMaxPer24h, MIN_GAP_MS, SAME_STORY_GAP_MS, WINDOW_MS };
