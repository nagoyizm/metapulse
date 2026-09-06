const { db } = require('../database/db');

class SlotService {
  /**
   * Obtiene los próximos N slots disponibles para programación.
   * Utiliza la tabla `schedule_slots` si hay slots activos configurados, o slots sugeridos a las 12:00 y 18:00.
   * @param {number} count Cantidad de slots requeridos
   * @param {Object} options Opciones (defaultHour, spacingDays)
   * @returns {Array<string>} Fechas en formato ISO local (YYYY-MM-DDTHH:mm:ss)
   */
  getAvailableSlots(count = 5, options = {}) {
    // 1. Obtener slots configurados por el usuario
    const activeDbSlots = db.prepare(`
      SELECT day_of_week, time_slot 
      FROM schedule_slots 
      WHERE is_active = 1
      ORDER BY day_of_week ASC, time_slot ASC
    `).all();

    // 2. Posts ya programados a futuro para no duplicar horas
    const existingPosts = db.prepare(`
      SELECT scheduled_at 
      FROM posts 
      WHERE status = 'scheduled' 
        AND scheduled_at IS NOT NULL
        AND scheduled_at > datetime('now', 'localtime')
      ORDER BY scheduled_at ASC
    `).all().map(r => new Date(r.scheduled_at).getTime());

    const resultSlots = [];
    let currentDay = new Date();
    // Empezar a partir de mañana o hoy si faltan más de 2 horas para el slot
    const pad = (n) => String(n).padStart(2, '0');

    let safety = 0;
    while (resultSlots.length < count && safety < 120) {
      safety++;
      const currentDow = currentDay.getDay(); // 0=Dom ... 6=Sab

      // Si el usuario tiene slots configurados en la BD para este día de la semana
      const matchingSlots = activeDbSlots.filter(s => s.day_of_week === currentDow);

      if (matchingSlots.length > 0) {
        for (const s of matchingSlots) {
          const [h, m] = s.time_slot.split(':').map(Number);
          const candidate = new Date(currentDay);
          candidate.setHours(h, m || 0, 0, 0);

          if (candidate.getTime() <= Date.now() + 45 * 60 * 1000) continue;

          // No colisionar con posts existentes (margen de 2h)
          const collision = existingPosts.some(t => Math.abs(t - candidate.getTime()) < 2 * 60 * 60 * 1000);
          const alreadyPicked = resultSlots.some(iso => Math.abs(new Date(iso).getTime() - candidate.getTime()) < 2 * 60 * 60 * 1000);

          if (!collision && !alreadyPicked) {
            resultSlots.push(candidate.toISOString());
            if (resultSlots.length >= count) break;
          }
        }
      } else if (activeDbSlots.length === 0) {
        // Fallback si no hay slots en BD: distribuir días consecutivos a las 12:00 y 18:00
        for (const h of [12, 18]) {
          const candidate = new Date(currentDay);
          candidate.setHours(h, 0, 0, 0);
          if (candidate.getTime() <= Date.now() + 45 * 60 * 1000) continue;

          const collision = existingPosts.some(t => Math.abs(t - candidate.getTime()) < 2 * 60 * 60 * 1000);
          const alreadyPicked = resultSlots.some(iso => Math.abs(new Date(iso).getTime() - candidate.getTime()) < 2 * 60 * 60 * 1000);

          if (!collision && !alreadyPicked) {
            resultSlots.push(candidate.toISOString());
            if (resultSlots.length >= count) break;
          }
        }
      }

      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Si aún faltan slots (por ejemplo si hay pocos slots semanales configurados), llenar días siguientes a las 12:00
    while (resultSlots.length < count) {
      const candidate = new Date(currentDay);
      candidate.setHours(12, 0, 0, 0);
      resultSlots.push(candidate.toISOString());
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return resultSlots;
  }
}

module.exports = new SlotService();
