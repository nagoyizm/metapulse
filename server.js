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

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar existencia de directorios de almacenamiento
const dirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads/watermarks'),
  path.join(__dirname, 'uploads/processed'),
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
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Servir archivos multimedia subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas de la API
app.use('/api', apiRoutes);

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Iniciar servidor y scheduler
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 MetaPulse Suite corriendo en: http://localhost:${PORT}`);
  console.log(`📊 Base de datos SQLite inicializada`);
  console.log(`🕒 Zona horaria activa: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log('====================================================');

  // Iniciar worker de programación
  schedulerService.start();

  // Iniciar worker de sincronización de Inbox y alertas WhatsApp
  inboxSyncService.start();
});
