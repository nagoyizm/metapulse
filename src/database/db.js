const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'metapulse.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL, -- 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
      time_slot TEXT NOT NULL,       -- HH:MM (24h)
      is_active INTEGER DEFAULT 1,
      platforms TEXT DEFAULT '["facebook","instagram"]'
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT NOT NULL,
      platforms TEXT NOT NULL DEFAULT '["facebook","instagram"]', -- JSON array
      post_type TEXT NOT NULL DEFAULT 'feed',                    -- 'feed', 'story', 'reel', 'carousel'
      media_urls TEXT DEFAULT '[]',                             -- JSON array of relative/public paths
      scheduled_at TEXT,                                        -- ISO string
      published_at TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',                 -- 'draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled'
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      meta_result TEXT DEFAULT '{}',                            -- JSON response from Meta API
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT,
      filepath TEXT NOT NULL,
      mime_type TEXT,
      filesize INTEGER,
      width INTEGER,
      height INTEGER,
      is_watermarked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watermarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value TEXT,
      period TEXT,
      recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      slots TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inbox_conversations (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'instagram',
      account_id TEXT,
      participant_id TEXT,
      participant_name TEXT,
      participant_username TEXT,
      participant_pic TEXT,
      last_message_text TEXT,
      last_message_at TEXT,
      unread_count INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inbox_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'instagram',
      sender_id TEXT NOT NULL,
      sender_name TEXT,
      sender_type TEXT NOT NULL,
      message_text TEXT NOT NULL,
      created_at TEXT,
      notified_whatsapp INTEGER DEFAULT 0,
      created_local_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inbox_comments (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL DEFAULT 'instagram',
      post_id TEXT NOT NULL,
      post_caption TEXT,
      post_media_url TEXT,
      post_permalink TEXT,
      from_id TEXT NOT NULL,
      from_name TEXT,
      comment_text TEXT NOT NULL,
      created_at TEXT,
      reply_count INTEGER DEFAULT 0,
      is_answered INTEGER DEFAULT 0,
      reply_text TEXT,
      notified_whatsapp INTEGER DEFAULT 0,
      created_local_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.prepare('ALTER TABLE posts ADD COLUMN meta_post_id TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE posts ADD COLUMN account_id TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE posts ADD COLUMN account_name TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE posts ADD COLUMN schedule_preset_name TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE media_items ADD COLUMN account_id TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE media_items ADD COLUMN account_name TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE watermarks ADD COLUMN account_id TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE watermarks ADD COLUMN account_name TEXT').run();
  } catch (_) {}

  // Populate default settings if empty
  const defaultSettings = [
    { key: 'simulation_mode', value: 'false' },
    { key: 'timezone', value: 'America/Santiago' },
    { key: 'ai_provider', value: 'gemini' },
    { key: 'ai_model', value: 'gemini-1.5-flash' },
    { key: 'public_url_base', value: '' },
    { key: 'meta_app_id', value: '' },
    { key: 'meta_app_secret', value: '' },
    { key: 'meta_user_token', value: '' },
    { key: 'meta_page_id', value: '' },
    { key: 'meta_page_name', value: '' },
    { key: 'meta_page_token', value: '' },
    { key: 'meta_instagram_id', value: '' },
    { key: 'meta_instagram_username', value: '' },
    { key: 'meta_token_expires_at', value: '' },
    { key: 'whatsapp_notifications_enabled', value: 'false' },
    { key: 'whatsapp_phone', value: '' },
    { key: 'whatsapp_api_key', value: '' },
    { key: 'whatsapp_notify_dms', value: 'true' },
    { key: 'whatsapp_notify_comments', value: 'true' },
    { key: 'whatsapp_service_type', value: 'callmebot' },
    { key: 'inbox_poll_interval_seconds', value: '90' },
    { key: 'inbox_last_synced_at', value: '' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }

  // Populate default slots if table is empty
  const countSlots = db.prepare('SELECT COUNT(*) as count FROM schedule_slots').get();
  if (countSlots.count === 0) {
    const defaultSlots = [
      // Miércoles (day 3): 13:00 y 19:00
      { day: 3, time: '13:00' },
      { day: 3, time: '19:00' },
      // Sábado (day 6): 11:00 y 18:00
      { day: 6, time: '11:00' },
      { day: 6, time: '18:00' }
    ];

    const insertSlot = db.prepare(`
      INSERT INTO schedule_slots (day_of_week, time_slot, is_active, platforms)
      VALUES (?, ?, 1, '["facebook","instagram"]')
    `);

    const insertMany = db.transaction((slots) => {
      for (const slot of slots) {
        insertSlot.run(slot.day, slot.time);
      }
    });

    insertMany(defaultSlots);
  }

  // Populate default schedule presets if empty
  const countPresets = db.prepare('SELECT COUNT(*) as count FROM schedule_presets').get();
  if (countPresets.count === 0) {
    const defaultPresets = [
      {
        name: 'Prueba 1: Miércoles y Sábados',
        description: 'Horario clásico: Miércoles (13:00, 19:00) y Sábados (11:00, 18:00)',
        slots: JSON.stringify([
          { day_of_week: 3, time_slot: '13:00', is_active: 1 },
          { day_of_week: 3, time_slot: '19:00', is_active: 1 },
          { day_of_week: 6, time_slot: '11:00', is_active: 1 },
          { day_of_week: 6, time_slot: '18:00', is_active: 1 }
        ]),
        is_active: 1
      },
      {
        name: 'Prueba 2: Tarde / Noche (Lun, Mié, Vie)',
        description: 'Horario estelar después de oficina: 19:30 y 21:00',
        slots: JSON.stringify([
          { day_of_week: 1, time_slot: '20:00', is_active: 1 },
          { day_of_week: 3, time_slot: '20:30', is_active: 1 },
          { day_of_week: 5, time_slot: '19:30', is_active: 1 }
        ]),
        is_active: 0
      }
    ];

    const insertPreset = db.prepare(`
      INSERT INTO schedule_presets (name, description, slots, is_active)
      VALUES (?, ?, ?, ?)
    `);

    for (const p of defaultPresets) {
      insertPreset.run(p.name, p.description, p.slots, p.is_active);
    }
  }
}

// Helpers for settings
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  for (const r of rows) {
    settingsObj[r.key] = r.value;
  }
  return settingsObj;
}

function setSetting(key, value) {
  return db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value));
}

function setMultipleSettings(settingsObj) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        stmt.run(k, String(v));
      }
    }
  });
  tx(settingsObj);
}

// Helpers para Inbox & Conversaciones
function upsertConversation(conv) {
  const stmt = db.prepare(`
    INSERT INTO inbox_conversations (
      id, platform, account_id, participant_id, participant_name,
      participant_username, participant_pic, last_message_text, last_message_at,
      unread_count, is_archived, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      participant_name = COALESCE(excluded.participant_name, inbox_conversations.participant_name),
      participant_username = COALESCE(excluded.participant_username, inbox_conversations.participant_username),
      participant_pic = COALESCE(excluded.participant_pic, inbox_conversations.participant_pic),
      last_message_text = COALESCE(excluded.last_message_text, inbox_conversations.last_message_text),
      last_message_at = COALESCE(excluded.last_message_at, inbox_conversations.last_message_at),
      unread_count = excluded.unread_count,
      updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(
    conv.id,
    conv.platform || 'instagram',
    conv.account_id || null,
    conv.participant_id || null,
    conv.participant_name || 'Usuario',
    conv.participant_username || null,
    conv.participant_pic || null,
    conv.last_message_text || '',
    conv.last_message_at || new Date().toISOString(),
    conv.unread_count !== undefined ? conv.unread_count : 0,
    conv.is_archived ? 1 : 0
  );
}

function getInboxConversations() {
  return db.prepare(`
    SELECT * FROM inbox_conversations
    WHERE is_archived = 0
    ORDER BY last_message_at DESC
  `).all();
}

function getInboxConversationById(id) {
  return db.prepare('SELECT * FROM inbox_conversations WHERE id = ?').get(id);
}

function upsertInboxMessage(msg) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO inbox_messages (
      id, conversation_id, platform, sender_id, sender_name,
      sender_type, message_text, created_at, notified_whatsapp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    msg.id,
    msg.conversation_id,
    msg.platform || 'instagram',
    msg.sender_id,
    msg.sender_name || null,
    msg.sender_type || 'customer',
    msg.message_text,
    msg.created_at || new Date().toISOString(),
    msg.notified_whatsapp ? 1 : 0
  );
}

function getInboxMessagesByConversation(conversationId) {
  return db.prepare(`
    SELECT * FROM inbox_messages
    WHERE conversation_id = ?
    ORDER BY datetime(created_at) ASC, id ASC
  `).all(conversationId);
}

function getUnnotifiedMessages() {
  return db.prepare(`
    SELECT * FROM inbox_messages
    WHERE sender_type = 'customer' AND notified_whatsapp = 0
    ORDER BY created_at ASC
  `).all();
}

function markMessageNotified(id) {
  return db.prepare('UPDATE inbox_messages SET notified_whatsapp = 1 WHERE id = ?').run(id);
}

// Helpers para Comentarios
function upsertInboxComment(c) {
  const stmt = db.prepare(`
    INSERT INTO inbox_comments (
      id, platform, post_id, post_caption, post_media_url, post_permalink,
      from_id, from_name, comment_text, created_at, reply_count, is_answered, reply_text, notified_whatsapp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reply_count = excluded.reply_count,
      is_answered = MAX(inbox_comments.is_answered, excluded.is_answered),
      reply_text = COALESCE(excluded.reply_text, inbox_comments.reply_text)
  `);
  return stmt.run(
    c.id,
    c.platform || 'instagram',
    c.post_id,
    c.post_caption || '',
    c.post_media_url || null,
    c.post_permalink || null,
    c.from_id,
    c.from_name || 'Usuario',
    c.comment_text,
    c.created_at || new Date().toISOString(),
    c.reply_count || 0,
    c.is_answered ? 1 : 0,
    c.reply_text || null,
    c.notified_whatsapp ? 1 : 0
  );
}

function getInboxComments(filter = 'all') {
  let query = 'SELECT * FROM inbox_comments';
  if (filter === 'unanswered') {
    query += ' WHERE is_answered = 0';
  } else if (filter === 'answered') {
    query += ' WHERE is_answered = 1';
  }
  query += ' ORDER BY datetime(created_at) DESC';
  return db.prepare(query).all();
}

function markCommentAnswered(commentId, replyText) {
  return db.prepare(`
    UPDATE inbox_comments
    SET is_answered = 1, reply_text = ?, reply_count = reply_count + 1
    WHERE id = ?
  `).run(replyText, commentId);
}

function getUnnotifiedComments() {
  return db.prepare(`
    SELECT * FROM inbox_comments
    WHERE notified_whatsapp = 0
    ORDER BY created_at ASC
  `).all();
}

function markCommentNotified(id) {
  return db.prepare('UPDATE inbox_comments SET notified_whatsapp = 1 WHERE id = ?').run(id);
}

module.exports = {
  db,
  initializeDatabase,
  getSetting,
  getAllSettings,
  setSetting,
  setMultipleSettings,
  upsertConversation,
  getInboxConversations,
  getInboxConversationById,
  upsertInboxMessage,
  getInboxMessagesByConversation,
  getUnnotifiedMessages,
  markMessageNotified,
  upsertInboxComment,
  getInboxComments,
  markCommentAnswered,
  getUnnotifiedComments,
  markCommentNotified
};
