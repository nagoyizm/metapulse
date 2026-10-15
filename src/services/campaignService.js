const { db, getSetting } = require('../database/db');
const brandProfileService = require('./brandProfileService');

const VALID_KINDS = ['permanente', 'promo', 'disponibilidad', 'evento'];
const VALID_STATUSES = ['activa', 'pausada', 'archivada'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTodayChileDate() {
  try {
    const d = new Date();
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDayMonthSpanish(dStr) {
  if (!dStr) return '';
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${day} ${months[mIdx] || parts[1]}`;
  }
  return dStr;
}

class CampaignService {
  _parseCampaignRow(r) {
    if (!r) return null;
    let details = {};
    try {
      details = typeof r.details === 'string' ? JSON.parse(r.details || '{}') : (r.details || {});
    } catch (_) {
      details = {};
    }

    let openQuestions = [];
    try {
      openQuestions = typeof r.open_questions === 'string' ? JSON.parse(r.open_questions || '[]') : (r.open_questions || []);
    } catch (_) {
      openQuestions = [];
    }

    return {
      ...r,
      details,
      open_questions: openQuestions
    };
  }

  _validateCampaignData(data, isUpdate = false) {
    if (!isUpdate || 'brand_id' in data) {
      if (!data.brand_id) throw new Error('El campo brand_id es obligatorio');
      const brand = brandProfileService.getProfileById(data.brand_id);
      if (!brand) throw new Error(`El brand_id "${data.brand_id}" no existe en brand_profiles`);
    }

    if (!isUpdate || 'title' in data) {
      if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
        throw new Error('El título de la campaña es obligatorio');
      }
    }

    if (!isUpdate || 'directive' in data) {
      if (!data.directive || typeof data.directive !== 'string' || !data.directive.trim()) {
        throw new Error('La instrucción para la IA (directive) es obligatoria');
      }
    }

    if ('kind' in data && data.kind) {
      if (!VALID_KINDS.includes(data.kind)) {
        throw new Error(`Tipo de campaña "${data.kind}" inválido. Permitidos: ${VALID_KINDS.join(', ')}`);
      }
    }

    const startsOn = data.starts_on === '' ? null : (data.starts_on ?? null);
    const endsOn = data.ends_on === '' ? null : (data.ends_on ?? null);

    if (startsOn !== null) {
      if (!DATE_REGEX.test(startsOn) || isNaN(Date.parse(startsOn))) {
        throw new Error('starts_on debe tener formato YYYY-MM-DD o ser null');
      }
    }

    if (endsOn !== null) {
      if (!DATE_REGEX.test(endsOn) || isNaN(Date.parse(endsOn))) {
        throw new Error('ends_on debe tener formato YYYY-MM-DD o ser null');
      }
    }

    if (startsOn && endsOn && endsOn < startsOn) {
      throw new Error('ends_on no puede ser anterior a starts_on');
    }

    if ('status' in data && data.status) {
      if (!VALID_STATUSES.includes(data.status)) {
        throw new Error(`Estado "${data.status}" inválido. Permitidos: ${VALID_STATUSES.join(', ')}`);
      }
    }
  }

  list(brandId) {
    if (!brandId) return [];
    try {
      const rows = db.prepare(`
        SELECT * FROM brand_campaigns
        WHERE brand_id = ?
        ORDER BY 
          CASE status 
            WHEN 'activa' THEN 1 
            WHEN 'pausada' THEN 2 
            WHEN 'archivada' THEN 3 
            ELSE 4 
          END ASC,
          starts_on ASC,
          id DESC
      `).all(brandId);

      return rows.map(r => this._parseCampaignRow(r));
    } catch (err) {
      console.warn('[campaignService] Error en list:', err.message);
      return [];
    }
  }

  get(id) {
    if (!id) return null;
    try {
      const row = db.prepare('SELECT * FROM brand_campaigns WHERE id = ?').get(id);
      return this._parseCampaignRow(row);
    } catch (err) {
      console.warn('[campaignService] Error en get:', err.message);
      return null;
    }
  }

  create(data) {
    this._validateCampaignData(data, false);

    const brand_id = data.brand_id;
    const title = data.title.trim();
    const kind = data.kind || 'promo';
    const starts_on = data.starts_on === '' ? null : (data.starts_on || null);
    const ends_on = data.ends_on === '' ? null : (data.ends_on || null);
    const directive = data.directive.trim();
    const details = typeof data.details === 'object' ? JSON.stringify(data.details) : (data.details || '{}');
    const open_questions = Array.isArray(data.open_questions) ? JSON.stringify(data.open_questions) : (data.open_questions || '[]');
    const source_text = data.source_text || null;
    const status = data.status || 'activa';

    const stmt = db.prepare(`
      INSERT INTO brand_campaigns (
        brand_id, title, kind, starts_on, ends_on, directive, details, open_questions, source_text, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(brand_id, title, kind, starts_on, ends_on, directive, details, open_questions, source_text, status);
    return this.get(info.lastInsertRowid);
  }

  update(id, patch) {
    if (!id) throw new Error('ID de campaña requerido');
    const existing = this.get(id);
    if (!existing) throw new Error(`Ficha de campaña #${id} no encontrada`);

    const merged = { ...existing, ...patch };
    this._validateCampaignData(merged, true);

    const title = merged.title.trim();
    const kind = merged.kind || 'promo';
    const starts_on = merged.starts_on === '' ? null : (merged.starts_on || null);
    const ends_on = merged.ends_on === '' ? null : (merged.ends_on || null);
    const directive = merged.directive.trim();
    const details = typeof merged.details === 'object' ? JSON.stringify(merged.details) : (merged.details || '{}');
    const open_questions = Array.isArray(merged.open_questions) ? JSON.stringify(merged.open_questions) : (merged.open_questions || '[]');
    const source_text = merged.source_text !== undefined ? merged.source_text : existing.source_text;
    const status = merged.status || 'activa';

    db.prepare(`
      UPDATE brand_campaigns
      SET title = ?, kind = ?, starts_on = ?, ends_on = ?, directive = ?, details = ?, open_questions = ?, source_text = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, kind, starts_on, ends_on, directive, details, open_questions, source_text, status, id);

    return this.get(id);
  }

  remove(id) {
    if (!id) throw new Error('ID de campaña requerido');
    const existing = this.get(id);
    if (!existing) throw new Error(`Ficha de campaña #${id} no encontrada`);
    db.prepare('DELETE FROM brand_campaigns WHERE id = ?').run(id);
    return true;
  }

  getActive({ brandId, accountName, accountId, date, from, to } = {}) {
    try {
      let resolvedBrandId = brandId;
      if (!resolvedBrandId) {
        const prof = brandProfileService.getProfile(accountName, accountId);
        resolvedBrandId = prof?.id;
      }
      if (!resolvedBrandId) return [];

      let rows;
      if (from || to) {
        const rangeFrom = from || '1970-01-01';
        const rangeTo = to || '2099-12-31';
        rows = db.prepare(`
          SELECT * FROM brand_campaigns
          WHERE brand_id = ?
            AND status = 'activa'
            AND (starts_on IS NULL OR starts_on <= ?)
            AND (ends_on IS NULL OR ends_on >= ?)
          ORDER BY starts_on ASC, id ASC
        `).all(resolvedBrandId, rangeTo, rangeFrom);
      } else {
        const targetDate = date || getTodayChileDate();
        rows = db.prepare(`
          SELECT * FROM brand_campaigns
          WHERE brand_id = ?
            AND status = 'activa'
            AND (starts_on IS NULL OR starts_on <= ?)
            AND (ends_on IS NULL OR ends_on >= ?)
          ORDER BY starts_on ASC, id ASC
        `).all(resolvedBrandId, targetDate, targetDate);
      }

      return rows.map(r => this._parseCampaignRow(r));
    } catch (err) {
      console.warn('[campaignService] Error en getActive:', err.message);
      return [];
    }
  }

  buildCampaignBlock(campaigns) {
    try {
      if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
        return '';
      }

      const lines = [
        'INDICACIONES VIGENTES DEL CLIENTE (obligatorias, tienen prioridad sobre reglas generales de estilo):'
      ];
      const exceptions = [];
      let hasNonUrgentCampaign = false;

      for (const c of campaigns) {
        const details = typeof c.details === 'string' ? JSON.parse(c.details || '{}') : (c.details || {});
        const kindLabel = (c.kind ? c.kind.charAt(0).toUpperCase() + c.kind.slice(1).toLowerCase() : 'Promo');

        let dateLabel = '';
        if (c.starts_on && c.ends_on) {
          dateLabel = `${formatDayMonthSpanish(c.starts_on)}–${formatDayMonthSpanish(c.ends_on)}`;
        } else if (c.starts_on) {
          dateLabel = `desde ${formatDayMonthSpanish(c.starts_on)}`;
        } else if (c.ends_on) {
          dateLabel = `hasta ${formatDayMonthSpanish(c.ends_on)}`;
        }

        const tag = dateLabel ? `[${kindLabel} · ${dateLabel}]` : `[${kindLabel}]`;
        const condText = details.condiciones ? ` (Condiciones: ${details.condiciones})` : '';
        lines.push(`- ${tag} ${c.title}: ${c.directive}${condText}`);

        if (details.permitirUrgencia === true) {
          exceptions.push(`EXCEPCIÓN AUTORIZADA: para "${c.title}" sí puedes mencionar disponibilidad limitada real (es un hecho confirmado por el cliente), con tono sereno y sin exagerar.`);
        } else {
          hasNonUrgentCampaign = true;
        }
      }

      lines.push('Usa como máximo UNA promo por post y solo si encaja con el tema pedido. Nunca inventes condiciones, precios ni porcentajes distintos a los indicados.');

      if (exceptions.length > 0) {
        lines.push(...exceptions);
      }

      if (hasNonUrgentCampaign) {
        lines.push('Para las fichas sin excepción autorizada: NO menciones escasez, cupos limitados, "últimas" ni prisa por reservar.');
      }

      return lines.join('\n');
    } catch (err) {
      console.warn('[campaignService] Error en buildCampaignBlock:', err.message);
      return '';
    }
  }

  async parseBrief({ brandId, text, today }) {
    if (!brandId) throw new Error('brandId es requerido');
    if (!text || !text.trim()) throw new Error('El texto de indicaciones del cliente es requerido');

    const brandProfile = brandProfileService.getProfileById(brandId);
    if (!brandProfile) throw new Error(`Perfil de marca "${brandId}" no encontrado`);

    const todayDate = today || getTodayChileDate();
    const existingActive = this.getActive({ brandId });

    const activeListSummary = existingActive.length > 0
      ? existingActive.map(c => `- ${c.title} (${c.kind}, vigencia: ${c.starts_on || 'inicio'} a ${c.ends_on || 'fin'}): ${c.directive}`).join('\n')
      : 'Ninguna ficha activa actualmente.';

    const brandRulesText = Array.isArray(brandProfile.rules)
      ? brandProfile.rules.join('\n- ')
      : (brandProfile.rules || 'Sin reglas especiales');

    const prompt = `Eres un estratega de marketing y analista de campañas para redes sociales.
Tu tarea es convertir el texto libre que un cliente envió con indicaciones o promociones en fichas estructuradas de campaña para la marca.

FECHA DE HOY (referencia temporal obligatoria): ${todayDate}

PERFIL DE LA MARCA:
- Nombre: ${brandProfile.name || brandProfile.brandName || brandId}
- Voz de la marca: ${brandProfile.voice || 'Cercana y profesional'}
- Reglas editoriales y restricciones de la marca:
- ${brandRulesText}

FICHAS ACTIVAS EXISTENTES DE LA MARCA:
${activeListSummary}

TEXTO RECIBIDO DEL CLIENTE:
"""
${text.trim()}
"""

INSTRUCCIONES CLAVE DE EXTRACCIÓN Y AUDITORÍA:
1. Divide el texto en una o más campañas estructuradas si contiene varias ideas o promociones separadas.
2. Tipos válidos (kind): 'permanente' | 'promo' | 'disponibilidad' | 'evento'.
3. Resolución de fechas relativas:
   - Resuelve siempre al año y fechas correctas a partir de la fecha de hoy (${todayDate}).
   - Ej: "todo noviembre" -> starts_on: "YYYY-11-01", ends_on: "YYYY-11-30" (del próximo noviembre a partir de hoy).
   - Ej: "año nuevo" -> campaña que se publica desde aproximadamente 6 semanas antes de fin de año hasta el 31 de diciembre ("YYYY-12-31").
   - Si no tiene fecha de fin: ends_on: null. Si no tiene fecha de inicio (vigente desde ya): starts_on: "${todayDate}".
4. DIRECTIVA (directive): 1 a 4 frases concisas y claras con la instrucción final que leerá el redactor de IA para crear los posts.
5. NO INVENTAR DATOS: Si el cliente no indicó condiciones, precios, porcentajes, noches mínimas, o si el descuento aplica al total o solo estadía, NO inventes nada.
6. PREGUNTAS ABIERTAS (open_questions): Lista de strings con todo lo que falta definir o confirmar con el cliente (ej: si hay que acreditar edad o condición, si es combinable con otras promos, cuántas cabañas quedan, precio exacto, noches mínimas).
7. DETECCIÓN DE CONFLICTOS (conflicts):
   - Revisa si el pedido del cliente entra en conflicto directo con las reglas de la marca (ej: si la marca prohíbe terminantemente "quedan pocas reservas" o falsas urgencias y el cliente pide "últimas cabañas disponibles").
   - Si detectas conflicto, describe claramente el conflicto en el array "conflicts" para que el usuario humano decida, y deja "permitirUrgencia": false en details.
   - En "details": { "oferta": "", "publico": "", "dias": "", "condiciones": "", "cta": "", "permitirUrgencia": false }.

Devuelve ESTRICTAMENTE un objeto JSON con esta estructura:
{
  "campaigns": [
    {
      "title": "Título corto y claro de la campaña",
      "kind": "promo",
      "starts_on": "YYYY-MM-DD",
      "ends_on": "YYYY-MM-DD",
      "directive": "Instrucción clara de 1 a 4 frases para la IA",
      "details": {
        "oferta": "Detalle de la oferta o descuento",
        "publico": "A quién va dirigido",
        "dias": "Días aplicables (ej: lunes a jueves)",
        "condiciones": "Condiciones explícitas mencionadas",
        "cta": "Llamado a la acción recomendado",
        "permitirUrgencia": false
      },
      "open_questions": [
        "Pregunta 1 para confirmar con el cliente"
      ]
    }
  ],
  "conflicts": [
    "Descripción de cualquier contradicción encontrada con las reglas de la marca"
  ],
  "summary": "Resumen ejecutivo breve en 1-2 párrafos de lo interpretado"
}`;

    const aiService = require('./aiService');
    const result = await aiService.generateJSON({ prompt, temperature: 0.2 });
    const data = result.data || {};

    const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
    const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];

    // Las reglas anti-urgencia están en los prompts de copy, no en el perfil: se detectan aquí sin depender de la IA.
    // Sin \b: en JS no reconoce límites junto a letras acentuadas como "ú".
    const SCARCITY = /(últim[oa]s|(^|[^a-záéíóúñ])pocas?\s|(^|[^a-záéíóúñ])quedan\s|agotad|ap[uú]rate|cupos? limitad|disponibilidad limitada)/i;
    const scarce = [text, ...campaigns.map(c => `${c.title || ''} ${c.directive || ''} ${c.details?.oferta || ''}`)]
      .some(t => SCARCITY.test(t || ''));
    if (scarce && !conflicts.some(c => /urgencia|escasez|pocas|últim/i.test(c))) {
      conflicts.push('El cliente pide comunicar escasez ("últimas", "quedan pocas"), pero las reglas de copy prohíben las falsas urgencias. Si la disponibilidad limitada es real y confirmada, activa "Permitir mencionar disponibilidad limitada" en esa ficha; si no, el texto la omitirá.');
    }

    return {
      campaigns,
      conflicts,
      summary: data.summary || ''
    };
  }

  async planMonth({ brandId, month, postsPerWeek = 3 }) {
    if (!brandId) throw new Error('brandId es requerido');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error('Mes inválido. Debe tener formato YYYY-MM');

    const brandProfile = brandProfileService.getProfileById(brandId);
    if (!brandProfile) throw new Error(`Perfil de marca "${brandId}" no encontrado`);

    const [yStr, mStr] = month.split('-');
    const year = parseInt(yStr, 10);
    const mNum = parseInt(mStr, 10);
    const lastDay = new Date(year, mNum, 0).getDate();
    const fromDate = `${month}-01`;
    const toDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    const activeCampaigns = this.getActive({ brandId, from: fromDate, to: toDate });
    const validCampaignIds = new Set(activeCampaigns.map(c => c.id));

    // Obtener keywords de la marca para buscar posts existentes
    let keywords = [];
    try {
      const row = db.prepare('SELECT match_keywords FROM brand_profiles WHERE id = ?').get(brandId);
      if (row?.match_keywords) {
        keywords = JSON.parse(row.match_keywords);
      }
    } catch (_) {}

    if (keywords.length === 0) {
      keywords = [brandProfile.name || brandId];
    }

    const likeClauses = keywords.map(() => 'LOWER(account_name) LIKE ?').join(' OR ');
    const likeParams = keywords.map(k => `%${String(k).toLowerCase().trim()}%`);

    let existingPosts = [];
    try {
      existingPosts = db.prepare(`
        SELECT id, scheduled_at, title, substr(content, 1, 140) as content, status
        FROM posts
        WHERE status IN ('draft', 'scheduled', 'published')
          AND scheduled_at >= ? AND scheduled_at <= ?
          AND (${likeClauses})
        ORDER BY scheduled_at ASC
      `).all(`${fromDate}T00:00:00`, `${toDate}T23:59:59`, ...likeParams);
    } catch (err) {
      console.warn('[campaignService] Error buscando posts existentes:', err.message);
    }

    // Horarios de schedule_slots si existen
    let scheduleSlots = [];
    try {
      scheduleSlots = db.prepare('SELECT day_of_week, time_slot, platforms FROM schedule_slots WHERE is_active = 1').all();
    } catch (_) {}

    const campaignsContext = activeCampaigns.length > 0
      ? activeCampaigns.map(c => `- ID ${c.id}: "${c.title}" (${c.kind}, vigencia: ${c.starts_on || 'siempre'} al ${c.ends_on || 'siempre'}). Directiva: ${c.directive}`).join('\n')
      : 'No hay campañas vigentes para este mes.';

    const existingPostsContext = existingPosts.length > 0
      ? existingPosts.map(p => `- ${p.scheduled_at ? new Date(p.scheduled_at).toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 16) : 's/f'} [${p.status}]: ${p.title || p.content}`).join('\n')
      : 'No hay publicaciones agendadas aún para este mes.';

    const slotsContext = scheduleSlots.length > 0
      ? scheduleSlots.map(s => {
          const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          return `${days[s.day_of_week]} a las ${s.time_slot}`;
        }).join(', ')
      : 'Sin franjas horarias fijas (usar horarios estratégicos habituales: 10:30, 13:00, 19:30).';

    const brandRules = Array.isArray(brandProfile.rules) ? brandProfile.rules.join('\n- ') : (brandProfile.rules || '');

    const prompt = `Eres el estratega senior de contenidos para redes sociales.
Debes diseñar el Plan Editorial del mes de ${month} para la marca "${brandProfile.name || brandId}".

CONTEXTO EDITORIAL DE LA MARCA:
- Nombre: ${brandProfile.name || brandId}
- Voz: ${brandProfile.voice || 'Cercana y profesional'}
- Reglas:
- ${brandRules}

CAMPAÑAS E INDICACIONES VIGENTES PARA ESTE MES:
${campaignsContext}

PUBLICACIONES YA PROGRAMADAS/EXISTENTES ESTE MES (NO dupliques ni choques con estos días/horarios):
${existingPostsContext}

FRANJAS HORARIAS HABITUALES:
${slotsContext}

PARÁMETROS DEL PLAN:
- Mes: ${month} (días 01 al ${lastDay})
- Frecuencia objetivo: ${postsPerWeek} publicaciones por semana distribuidas uniformemente, incluida la primera y la última semana del mes. Entrega EXACTAMENTE ${Math.round(postsPerWeek * lastDay / 7)} ítems (sin contar las publicaciones ya existentes), nunca dos el mismo día salvo que el mes no alcance.
- Si una campaña tiene vigencia acotada, SOLO puedes proponer publicaciones vinculadas a ella (campaign_id) DENTRO de sus fechas de vigencia. Nunca fuera.
- Mezcla publicaciones de marca (branding, valor, comunidad, sin campaña, con campaign_id: null) con publicaciones de campañas/promociones activas.
- Considera feriados y días festivos de Chile relevantes en el mes.
- Considera el comportamiento del consumidor: en hospedaje/turismo la gente planifica y cotiza principalmente de domingo a martes; para comercio o comida los picos son miércoles a sábado.

Entrega ESTRICTAMENTE un JSON con este formato:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "format": "feed",
      "campaign_id": 1,
      "angle": "Ángulo o enfoque temático claro de la publicación",
      "hook": "Gancho inicial de menos de 120 caracteres para atrapar al lector",
      "why": "Razón estratégica de este post en esta fecha"
    }
  ],
  "notes": "Resumen explicativo del criterio de distribución aplicado"
}`;

    const aiService = require('./aiService');
    const result = await aiService.generateJSON({ prompt, temperature: 0.3 });
    const rawItems = result.data?.items || [];

    // Validar en código: fecha dentro del mes, formato válido, campaign_id válido si existe
    const validItems = rawItems.filter(item => {
      if (!item || !item.date || typeof item.date !== 'string') return false;
      if (!item.date.startsWith(`${month}-`)) return false;
      const parts = item.date.split('-');
      if (parts.length !== 3) return false;
      const day = parseInt(parts[2], 10);
      if (isNaN(day) || day < 1 || day > lastDay) return false;

      if (item.campaign_id !== null && item.campaign_id !== undefined && item.campaign_id !== '') {
        const numId = Number(item.campaign_id);
        if (!validCampaignIds.has(numId)) {
          return false; // Descartar si el campaign_id no existe
        }
        item.campaign_id = numId;
      } else {
        item.campaign_id = null;
      }

      if (!item.time || !/^\d{1,2}:\d{2}$/.test(item.time)) {
        item.time = '11:00';
      }

      const VALID_FORMATS = ['feed', 'carousel', 'reel', 'story'];
      if (!item.format || !VALID_FORMATS.includes(item.format.toLowerCase())) {
        item.format = 'feed';
      } else {
        item.format = item.format.toLowerCase();
      }

      return true;
    });

    return {
      items: validItems,
      notes: result.data?.notes || ''
    };
  }

  async createDraftsFromPlan({ brandId, items }) {
    if (!brandId) throw new Error('brandId es requerido');
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('La lista de ítems a crear está vacía');
    }

    const brandProfile = brandProfileService.getProfileById(brandId);
    let keywords = [];
    try {
      const row = db.prepare('SELECT match_keywords FROM brand_profiles WHERE id = ?').get(brandId);
      if (row?.match_keywords) {
        keywords = JSON.parse(row.match_keywords);
      }
    } catch (_) {}

    if (keywords.length === 0 && brandProfile?.name) {
      keywords = [brandProfile.name];
    }

    // Resolver account_id y account_name buscando en cached_managed_accounts
    let resolvedAccountId = null;
    let resolvedAccountName = null;

    try {
      const cachedStr = getSetting('cached_managed_accounts');
      if (cachedStr) {
        const accounts = JSON.parse(cachedStr);
        if (Array.isArray(accounts)) {
          const lowerKws = keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean);
          for (const acc of accounts) {
            const pageName = (acc.pageName || acc.name || '').toLowerCase();
            const igUser = (acc.instagram?.username || acc.instagramUsername || '').toLowerCase();
            const match = lowerKws.some(k => pageName.includes(k) || igUser.includes(k));
            if (match) {
              resolvedAccountId = acc.pageId || acc.id || null;
              resolvedAccountName = acc.pageName || acc.name || null;
              break;
            }
          }
        }
      }
    } catch (accErr) {
      console.warn('[campaignService] Error resolviendo cuenta asociada:', accErr.message);
    }

    const aiService = require('./aiService');
    const createdIds = [];
    const failedItems = [];

    // Procesar de manera SECUENCIAL para no saturar la cuota gratuita de Gemini
    for (const item of items) {
      try {
        let campaignBlock = '';
        if (item.campaign_id) {
          const camp = this.get(item.campaign_id);
          if (camp) {
            campaignBlock = this.buildCampaignBlock([camp]);
          }
        }

        const topicText = `${item.angle || 'Publicación'}${item.hook ? '. Gancho: ' + item.hook : ''}`;
        let content = topicText;

        try {
          const copyRes = await aiService.generateCopy({
            topic: topicText,
            brandName: brandProfile?.name || brandId,
            customInstructions: campaignBlock,
            bypassCache: true
          });
          if (copyRes?.fullPost) {
            content = copyRes.fullPost;
          }
        } catch (copyErr) {
          console.warn(`[createDraftsFromPlan] Falló generateCopy para ítem (${item.angle}):`, copyErr.message);
          // Fallback: usar angle + hook
          content = topicText;
        }

        const title = (item.angle || 'Publicación').slice(0, 80);
        const postType = item.format || 'feed';

        const timePart = item.time && /^\d{1,2}:\d{2}$/.test(item.time) ? item.time : '11:00';
        const dtStr = `${item.date}T${timePart.padStart(5, '0')}:00`;
        const scheduledAt = new Date(dtStr).toISOString();

        const insertStmt = db.prepare(`
          INSERT INTO posts (title, content, platforms, post_type, media_urls, scheduled_at, status, account_id, account_name)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        `);

        const info = insertStmt.run(
          title,
          content,
          JSON.stringify(['facebook', 'instagram']),
          postType,
          '[]',
          scheduledAt,
          resolvedAccountId,
          resolvedAccountName
        );

        createdIds.push(info.lastInsertRowid);
      } catch (itemErr) {
        console.error('[createDraftsFromPlan] Error creando borrador:', itemErr.message);
        failedItems.push({ item, error: itemErr.message });
      }
    }

    return {
      created: createdIds,
      failed: failedItems
    };
  }
}

module.exports = new CampaignService();
