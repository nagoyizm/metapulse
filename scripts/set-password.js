// Cambia (o crea) la contraseña de un usuario sin dejarla en el código ni en el historial del shell.
// Uso: ADMIN_EMAIL=tu@correo NEW_PASSWORD='clave-larga' node scripts/set-password.js
require('dotenv').config();
const { initializeDatabase } = require('../src/database/db');
initializeDatabase();
const authService = require('../src/services/authService');
const email = process.env.ADMIN_EMAIL;
const pass = process.env.NEW_PASSWORD;
try {
  authService.setPassword(email, pass);
  console.log('Contraseña actualizada para ' + email + '. Se cerraron sus sesiones abiertas.');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
