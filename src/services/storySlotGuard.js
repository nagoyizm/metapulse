const { db } = require('../database/db');

// Separación mínima entre dos historias de la misma cuenta.
const MIN_GAP_MS = 90 * 60 * 1000;
// Una historia dura 24 h: la misma historia no puede repetirse antes de eso o se ven dos a la vez.
const SAME_STORY_GAP_MS = 25 * 60 * 60 * 1000;
const SHIFT_MS = 30 * 60 * 1000;
const DAY_START_H = 8;
const DAY_END_H = 23;

function acctClause(accountId) {
  return accountId ? { sql: 'account_id = ?', params: [accountId] } : { sql: 'account_id IS NULL', params: [] };
}

// Clave del contenido de la historia: el título sin el prefijo "[Historia 2/8 • ...]:" ni "Story:".
function storyKey(title) {
  return String(title || '').replace(/^(\[[^\]]*\]|Story):\s*/, '').trim().toLowerCase();
}

function conflicts(t, key, taken) {
  return taken.some(o => Math.abs(o.t - t) < (o.key === key && key ? SAME_STORY_GAP_MS : MIN_GAP_MS));
}

const HOUR_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: 'numeric', hour12: false });
function chileHour(ms) {
  return Number(HOUR_FMT.format(new Date(ms))) % 24;
}

// Mueve t hacia adelante en pasos de 30 min hasta no chocar, sin salir de 08:00-23:00 hora de Chile.
function nextFree(t, key, taken) {
  let cur = t;
  for (let i = 0; i < 400 && conflicts(cur, key, taken); i++) {
    do {
      cur += SHIFT_MS;
    } while (chileHour(cur) >= DAY_END_H || chileHour(cur) < DAY_START_H);
  }
  return cur;
}

function occupied(accountId) {
  const c = acctClause(accountId);
  const rows = db.prepare(`
    SELECT title, scheduled_at FROM posts
    WHERE post_type = 'story' AND status = 'scheduled' AND scheduled_at IS NOT NULL AND ${c.sql}
  `).all(...c.params);
  return rows.map(r => ({ t: new Date(r.scheduled_at).getTime(), key: storyKey(r.title) })).filter(o => !isNaN(o.t));
}

// Ajusta una lista [{schedule: ISO, ...}] para que no choque con historias ya agendadas ni entre sí.
// title = título del post de origen (para no repetir la misma historia en menos de 25 h).
function separateSchedules(items, accountId, title = '') {
  const key = storyKey(title);
  const taken = occupied(accountId);
  return items.map(item => {
    const t = new Date(item.schedule).getTime();
    if (isNaN(t)) return item;
    const free = nextFree(t, key, taken);
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

  // Las ya publicadas en las últimas 25 h también ocupan lugar para la misma historia.
  const recent = db.prepare(`
    SELECT title, scheduled_at, account_id FROM posts
    WHERE post_type = 'story' AND status = 'published' AND scheduled_at > ?
  `).all(new Date(Date.now() - SAME_STORY_GAP_MS).toISOString());

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
      const free = nextFree(t, key, taken);
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

module.exports = { separateSchedules, repairScheduledStories, storyKey, MIN_GAP_MS, SAME_STORY_GAP_MS };
