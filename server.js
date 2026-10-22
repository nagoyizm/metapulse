// Forzar huso horario de Chile (America/Santiago) para toda la aplicación y el motor de agendamiento
process.env.TZ = process.env.TZ || 'America/Santiago';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initializeDatabase } = require('./src/database/db');
const apiRoutes = require('./src/routes/api');
const schedulerService = require('./src/services/schedulerService');
const inboxSyncService = require('./src/services/inboxSyncService');
const mediaCleanupService = require('./src/services/mediaCleanupService');

const app = express();
const PORT = process.env.PORT || 3000;
// HOST=127.0.0.1 deja la app accesible solo desde el proxy HTTPS local (Caddy).
const HOST = process.env.HOST || '0.0.0.0';

// Asegurar existencia de directorios de almacenamiento
const dirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/watermarks'),
  path.join(__dirname, 'uploads/processed'),
  path.join(__dirname, 'uploads/audio'),
  path.join(__dirname, 'uploads/audio/cache'),
  path.join(__dirname, 'uploads/stories'),
  path.join(__dirname, 'uploads/meta_cache'),
  path.join(__dirname, 'public')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// Inicializar base de datos SQLite
initializeDatabase();

// Middlewares
// Detrás de Caddy (loopback) se confía en X-Forwarded-For para obtener la IP real y saber si es HTTPS
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
// La interfaz es del mismo origen: no se permiten otros orígenes
app.use(cors({ origin: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Servir archivos multimedia subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Miniaturas de stickers para el diseñador de historias
app.use('/assets-stickers', express.static(path.join(__dirname, 'assets/stickers/noto')));

// Rutas de la API
app.use('/api', apiRoutes);

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Iniciar servidor y scheduler
const httpServer = app.listen(PORT, HOST, () => {
  // Subidas grandes de video en conexiones lentas: sin el corte de 5 min por defecto
  httpServer.requestTimeout = 0;
  mediaCleanupService.startDailyCleanup();
  httpServer.headersTimeout = 60 * 1000;
  console.log('====================================================');
  console.log(`🚀 MetaPulse Suite corriendo en: http://localhost:${PORT}`);
  console.log(`📊 Base de datos SQLite inicializada`);
  console.log(`🕒 Zona horaria activa: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log('====================================================');

  // Iniciar worker de programación
  schedulerService.start();

  // Iniciar worker de sincronización de Inbox y alertas WhatsApp
  inboxSyncService.start();

  // Iniciar sincronización diaria de métricas de posts
  require('./src/services/metricsSyncService').start();

  // Vigilar me gusta y comentarios de Instagram (feed de la pestaña Actividad)
  require('./src/services/engagementWatchService').start();
});
