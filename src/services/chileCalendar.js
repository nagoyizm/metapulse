class ChileCalendar {
  /**
   * Formatea y describe una fecha en la zona horaria America/Santiago.
   * Retorna estación del año, feriados cercanos (-2 a +21 días), indicador de fin de semana largo y nota descriptiva.
   *
   * @param {string|Date} dateInput
   * @returns {{
   *   dateLabel: string,
   *   season: string,
   *   nearHolidays: Array<{ name: string, date: string, daysAway: number }>,
   *   longWeekend: boolean,
   *   note: string
   * }}
   */
  describe(dateInput) {
    const cur = this._getSantiagoDate(dateInput);
    const season = this._getSeason(cur.month);
    const dateLabel = this._formatDateLabel(cur.year, cur.month, cur.day);

    const allEvents = [
      ...this._getEventsForYear(cur.year - 1),
      ...this._getEventsForYear(cur.year),
      ...this._getEventsForYear(cur.year + 1)
    ];

    const curUtc = Date.UTC(cur.year, cur.month - 1, cur.day);

    const nearHolidays = [];
    for (const ev of allEvents) {
      const evUtc = Date.UTC(ev.year, ev.month - 1, ev.day);
      const daysAway = Math.round((evUtc - curUtc) / (24 * 60 * 60 * 1000));
      if (daysAway >= -2 && daysAway <= 21) {
        nearHolidays.push({
          name: ev.name,
          date: ev.date,
          daysAway
        });
      }
    }

    nearHolidays.sort((a, b) => a.daysAway - b.daysAway);

    const longWeekend = this._detectLongWeekend(cur, allEvents);

    let note = '';
    if (longWeekend) {
      note = 'Fin de semana largo';
    } else if (nearHolidays.length > 0) {
      const closest = [...nearHolidays].sort((a, b) => Math.abs(a.daysAway) - Math.abs(b.daysAway))[0];
      if (closest.daysAway === 0) {
        note = `Hoy: ${closest.name}`;
      } else if (closest.daysAway > 0) {
        note = `Próximo a ${closest.name} (en ${closest.daysAway} días)`;
      } else {
        note = `Reciente: ${closest.name} (hace ${Math.abs(closest.daysAway)} días)`;
      }
    } else {
      note = `Semana estándar de ${season}`;
    }

    return {
      dateLabel,
      season,
      nearHolidays,
      longWeekend,
      note
    };
  }

  _getSantiagoDate(dateInput) {
    if (!dateInput) {
      dateInput = new Date();
    }
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, d] = dateInput.trim().split('-').map(Number);
      return { year: y, month: m, day: d };
    }
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const validDate = isNaN(d.getTime()) ? new Date() : d;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(validDate);

    const map = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return {
      year: parseInt(map.year, 10),
      month: parseInt(map.month, 10),
      day: parseInt(map.day, 10)
    };
  }

  _formatDateLabel(y, m, d) {
    const monthsEs = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const daysEs = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = daysEs[utcDate.getUTCDay()];
    return `${dayOfWeek}, ${d} de ${monthsEs[m - 1]} de ${y}`;
  }

  _getSeason(month) {
    if (month === 12 || month === 1 || month === 2) return 'verano';
    if (month >= 3 && month <= 5) return 'otoño';
    if (month >= 6 && month <= 8) return 'invierno';
    return 'primavera';
  }

  _getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { year, month, day };
  }

  _getHolyWeek(year) {
    const easter = this._getEasterSunday(year);
    const easterUtc = Date.UTC(easter.year, easter.month - 1, easter.day);
    const goodFriday = new Date(easterUtc - 2 * 24 * 60 * 60 * 1000);
    const holySaturday = new Date(easterUtc - 1 * 24 * 60 * 60 * 1000);
    return {
      goodFriday: { year: goodFriday.getUTCFullYear(), month: goodFriday.getUTCMonth() + 1, day: goodFriday.getUTCDate() },
      holySaturday: { year: holySaturday.getUTCFullYear(), month: holySaturday.getUTCMonth() + 1, day: holySaturday.getUTCDate() }
    };
  }

  _getNthSunday(year, month, n) {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCMonth() !== month - 1) break;
      if (d.getUTCDay() === 0) {
        count++;
        if (count === n) return { year, month, day };
      }
    }
    return null;
  }

  _getEventsForYear(year) {
    const holyWeek = this._getHolyWeek(year);
    const motherDay = this._getNthSunday(year, 5, 2);
    const fatherDay = this._getNthSunday(year, 6, 3);
    const childrenDay = this._getNthSunday(year, 8, 2);

    const list = [
      { name: 'Año Nuevo', month: 1, day: 1, isOfficial: true },
      { name: 'Viernes Santo', month: holyWeek.goodFriday.month, day: holyWeek.goodFriday.day, isOfficial: true },
      { name: 'Sábado Santo', month: holyWeek.holySaturday.month, day: holyWeek.holySaturday.day, isOfficial: true },
      { name: 'Día del Trabajo', month: 5, day: 1, isOfficial: true },
      { name: 'Día de las Glorias Navales', month: 5, day: 21, isOfficial: true },
      { name: 'Día Nacional de los Pueblos Indígenas', month: 6, day: 20, isOfficial: true },
      { name: 'San Pedro y San Pablo', month: 6, day: 29, isOfficial: true },
      { name: 'Día de la Virgen del Carmen', month: 7, day: 16, isOfficial: true },
      { name: 'Asunción de la Virgen', month: 8, day: 15, isOfficial: true },
      { name: 'Fiestas Patrias', month: 9, day: 18, isOfficial: true },
      { name: 'Día de las Glorias del Ejército', month: 9, day: 19, isOfficial: true },
      { name: 'Encuentro de Dos Mundos', month: 10, day: 12, isOfficial: true },
      { name: 'Día de las Iglesias Evangélicas y Protestantes', month: 10, day: 31, isOfficial: true },
      { name: 'Día de Todos los Santos', month: 11, day: 1, isOfficial: true },
      { name: 'Inmaculada Concepción', month: 12, day: 8, isOfficial: true },
      { name: 'Navidad', month: 12, day: 25, isOfficial: true },

      { name: 'Nochebuena', month: 12, day: 24, isOfficial: false },
      { name: 'Víspera de Año Nuevo', month: 12, day: 31, isOfficial: false },
      { name: 'Día de los Abuelos', month: 7, day: 26, isOfficial: false },
      { name: 'Día Internacional de las Personas Mayores', month: 10, day: 1, isOfficial: false }
    ];

    if (motherDay) {
      list.push({ name: 'Día de la Madre', month: motherDay.month, day: motherDay.day, isOfficial: false });
    }
    if (fatherDay) {
      list.push({ name: 'Día del Padre', month: fatherDay.month, day: fatherDay.day, isOfficial: false });
    }
    if (childrenDay) {
      list.push({ name: 'Día del Niño', month: childrenDay.month, day: childrenDay.day, isOfficial: false });
    }

    return list.map(item => ({
      ...item,
      year,
      date: `${year}-${String(item.month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`
    }));
  }

  _detectLongWeekend(cur, allEvents) {
    const curUtc = Date.UTC(cur.year, cur.month - 1, cur.day);
    const curDow = new Date(curUtc).getUTCDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sáb

    const officialHolidays = allEvents.filter(e => e.isOfficial);

    for (const h of officialHolidays) {
      const hUtc = Date.UTC(h.year, h.month - 1, h.day);
      const daysAway = Math.round((hUtc - curUtc) / (24 * 60 * 60 * 1000));
      const hDow = new Date(hUtc).getUTCDay();

      // Feriado en viernes (5): fin de semana largo abarca jueves(-1) a lunes(+3)
      if (hDow === 5 && daysAway >= -1 && daysAway <= 3) {
        return true;
      }

      // Feriado en lunes (1): fin de semana largo abarca viernes(-3) a martes(+1)
      if (hDow === 1 && daysAway >= -3 && daysAway <= 1) {
        return true;
      }

      // Feriado en jueves (4) con viernes adyacente o sándwich (ej: Fiestas Patrias)
      if (hDow === 4 && daysAway >= 0 && daysAway <= 4) {
        const nextDayHoliday = officialHolidays.some(other => {
          const otherUtc = Date.UTC(other.year, other.month - 1, other.day);
          return Math.round((otherUtc - hUtc) / (24 * 60 * 60 * 1000)) === 1;
        });
        if (nextDayHoliday) return true;
      }
    }

    return false;
  }
}

module.exports = new ChileCalendar();
