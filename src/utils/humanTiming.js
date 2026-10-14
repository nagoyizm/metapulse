// Utilidades para que los horarios no tengan patrón de bot (siempre en punto, reintentos fijos).
const crypto = require('node:crypto');

function randomInt(min, maxInclusive) {
  return crypto.randomInt(min, maxInclusive + 1);
}

// Devuelve una NUEVA fecha desplazada entre 3 y 17 minutos y 0-59 segundos después de la base.
function humanizeSlotTime(baseDate) {
  const d = new Date(baseDate.getTime());
  d.setMinutes(d.getMinutes() + randomInt(3, 17), randomInt(0, 59), 0);
  return d;
}

// Espera antes del reintento N (1, 2, 3...): 5 min * N + 0-6 min aleatorios, con segundos variables.
function getRetryDelayMs(attempt) {
  const n = Math.max(1, attempt);
  return (5 * n + randomInt(0, 5)) * 60 * 1000 + randomInt(0, 59) * 1000;
}

module.exports = { randomInt, humanizeSlotTime, getRetryDelayMs };
