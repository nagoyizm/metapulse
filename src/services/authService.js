const crypto = require('crypto');
const { db } = require('../database/db');

// Control de intentos fallidos por IP (Rate Limiting contra ataques de fuerza bruta)
const SESSION_DAYS = 14;
const failedAttempts = new Map(); // ip -> { count, lockedUntil }

class AuthService {
  constructor() {
    this.ensureTables();
    this.seedAdminUser();
  }

  ensureTables() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_email TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }

  hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  verifyPassword(password, hash, salt) {
    const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(checkHash, 'hex'), Buffer.from(hash, 'hex'));
  }

  // Crea el usuario inicial solo si no hay ninguno y ADMIN_EMAIL / ADMIN_PASSWORD están en el entorno.
  // Las contraseñas nunca van en el código; para cambiarla usa: node scripts/set-password.js
  seedAdminUser() {
    const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    if (count > 0) return;
    const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || password.length < 12) {
      console.warn('🔒 [AuthService] No hay usuarios. Define ADMIN_EMAIL y ADMIN_PASSWORD (12+ caracteres) en .env para crear el primero.');
      return;
    }
    this.setPassword(email, password, process.env.ADMIN_NAME || 'Administrador');
    console.log(`🔒 [AuthService] Usuario inicial creado: ${email}`);
  }

  // Crea o actualiza un usuario y cierra todas sus sesiones abiertas.
  setPassword(email, password, name = '') {
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!cleanEmail || String(password || '').length < 12) throw new Error('Correo y contraseña de 12+ caracteres requeridos.');
    const { hash, salt } = this.hashPassword(password);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, existing.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO users (email, password_hash, salt, name) VALUES (?, ?, ?, ?)').run(cleanEmail, hash, salt, name || cleanEmail);
    }
  }

  checkRateLimit(ip) {
    const record = failedAttempts.get(ip);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      return {
        allowed: false,
        error: `Demasiados intentos fallidos. Acceso bloqueado por ${remainingMinutes} minuto(s) por seguridad.`
      };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
      failedAttempts.delete(ip);
      return { allowed: true };
    }

    return { allowed: true };
  }

  recordFailedAttempt(ip, maxAttempts = 5) {
    const now = Date.now();
    const record = failedAttempts.get(ip) || { count: 0, lockedUntil: null };
    record.count += 1;

    if (record.count >= maxAttempts) {
      record.lockedUntil = now + 15 * 60 * 1000; // Bloqueo de 15 minutos tras 5 fallos
      console.warn(`🚨 [Auth] IP ${ip} bloqueada por 15 minutos por exceso de intentos fallidos.`);
    }

    failedAttempts.set(ip, record);
  }

  clearFailedAttempts(ip) {
    failedAttempts.delete(ip);
  }

  login({ email, password, ip, userAgent }) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPass = (password || '').trim();

    const acctKey = 'acct:' + cleanEmail;
    const rateCheck = this.checkRateLimit(ip);
    const acctCheck = cleanEmail ? this.checkRateLimit(acctKey) : { allowed: true };
    if (!acctCheck.allowed) return { success: false, error: acctCheck.error, status: 429 };
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error, status: 429 };
    }

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Debe ingresar correo y contraseña.', status: 400 };
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      this.recordFailedAttempt(ip);
      this.recordFailedAttempt(acctKey, 10);
      return { success: false, error: 'Correo o contraseña incorrectos.', status: 401 };
    }

    const isValid = this.verifyPassword(cleanPass, user.password_hash, user.salt);
    if (!isValid) {
      this.recordFailedAttempt(ip);
      this.recordFailedAttempt(acctKey, 10);
      return { success: false, error: 'Correo o contraseña incorrectos.', status: 401 };
    }

    // Login exitoso: limpiar bloqueos de intentos
    this.clearFailedAttempts(ip);
    this.clearFailedAttempts(acctKey);

    // Generar token criptográficamente seguro de 64 caracteres
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, user_id, user_email, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, user.id, user.email, ip || '', userAgent || '', expiresAt);

    return {
      success: true,
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || 'Andrés Vega'
      }
    };
  }

  validateSession(token) {
    if (!token) return null;

    const session = db.prepare(`
      SELECT s.*, u.name
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    return session || null;
  }

  logout(token) {
    if (!token) return false;
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return true;
  }

  parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
      let [name, ...rest] = cookie.split('=');
      name = name?.trim();
      if (!name) return;
      const value = rest.join('=').trim();
      list[name] = decodeURIComponent(value);
    });
    return list;
  }

  getTokenFromRequest(req) {
    // 1. De cookies HttpOnly
    const cookies = this.parseCookies(req);
    if (cookies.metapulse_session) {
      return cookies.metapulse_session;
    }

    // 2. Del header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // 3. Del header x-auth-token
    if (req.headers['x-auth-token']) {
      return req.headers['x-auth-token'].trim();
    }

    return null;
  }
}

const instance = new AuthService();
instance.SESSION_DAYS = SESSION_DAYS;
module.exports = instance;
