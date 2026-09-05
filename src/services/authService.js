const crypto = require('crypto');
const { db } = require('../database/db');

// Control de intentos fallidos por IP (Rate Limiting contra ataques de fuerza bruta)
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

  seedAdminUser() {
    const targetEmail = 'andresvegapozas@gmail.com'.toLowerCase().trim();
    const targetPassword = 'Rameroli00..';

    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
    if (!existingUser) {
      const { hash, salt } = this.hashPassword(targetPassword);
      db.prepare(`
        INSERT INTO users (email, password_hash, salt, name)
        VALUES (?, ?, ?, 'Andrés Vega')
      `).run(targetEmail, hash, salt);
      console.log(`🔒 [AuthService] Usuario maestro creado: ${targetEmail}`);
    } else {
      // Si ya existía, asegurar que las credenciales solicitadas estén actualizadas y vigentes
      const { hash, salt } = this.hashPassword(targetPassword);
      db.prepare(`
        UPDATE users
        SET password_hash = ?, salt = ?
        WHERE email = ?
      `).run(hash, salt, targetEmail);
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

  recordFailedAttempt(ip) {
    const now = Date.now();
    const record = failedAttempts.get(ip) || { count: 0, lockedUntil: null };
    record.count += 1;

    if (record.count >= 5) {
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

    const rateCheck = this.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error, status: 429 };
    }

    if (!cleanEmail || !cleanPass) {
      return { success: false, error: 'Debe ingresar correo y contraseña.', status: 400 };
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      this.recordFailedAttempt(ip);
      return { success: false, error: 'Correo o contraseña incorrectos.', status: 401 };
    }

    const isValid = this.verifyPassword(cleanPass, user.password_hash, user.salt);
    if (!isValid) {
      this.recordFailedAttempt(ip);
      return { success: false, error: 'Correo o contraseña incorrectos.', status: 401 };
    }

    // Login exitoso: limpiar bloqueos de intentos
    this.clearFailedAttempts(ip);

    // Generar token criptográficamente seguro de 64 caracteres
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 días

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

module.exports = new AuthService();
