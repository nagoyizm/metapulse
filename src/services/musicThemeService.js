// Búsqueda de música por tema ("celebración familiar de año nuevo", "hogareño y relajado") en varias fuentes
// de música libre, filtrando por licencia: solo se devuelven pistas que se pueden usar en una marca (uso comercial).
const axios = require('axios');
const http = require('http');
const { getSetting } = require('../database/db');
const musicService = require('./musicService');

const HTTP_TIMEOUT = 9000;
const MIN_DURATION_SEC = 45;

// Español -> etiquetas en inglés (las fuentes etiquetan en inglés). Sirve de respaldo si la IA no responde.
const ES_TO_EN = {
  familia: 'family acoustic', familiar: 'family acoustic', hogar: 'home acoustic', hogareño: 'home acoustic', hogareña: 'home acoustic', casa: 'home',
  celebración: 'celebration happy uplifting', celebracion: 'celebration happy uplifting', fiesta: 'party happy', 'año nuevo': 'newyear celebration happy', 'ano nuevo': 'newyear celebration happy',
  navidad: 'christmas', navideño: 'christmas', relajo: 'relax chill ambient', relajado: 'relax chill', relajante: 'relaxing chill', calma: 'calm',
  tranquilo: 'calm', acústico: 'acoustic', acustico: 'acoustic', guitarra: 'guitar', piano: 'piano', alegre: 'happy',
  feliz: 'happy', cálido: 'warm', calido: 'warm', cocina: 'cooking', café: 'coffee', cafe: 'coffee', verano: 'summer',
  playa: 'beach', naturaleza: 'nature', romántico: 'romantic', romantico: 'romantic', suave: 'soft', ambiente: 'ambient',
  tradicional: 'folk', folclor: 'folk', latino: 'latin', bossa: 'bossa', jazz: 'jazz', optimista: 'uplifting', amor: 'love',
  esperanza: 'hope', inspirador: 'inspiring', cumpleaños: 'birthday', celebrar: 'celebration'
};

const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function fallbackTags(theme) {
  const out = [];
  const add = (t) => { if (t && !out.includes(t)) out.push(t); };
  const text = stripAccents(theme);
  for (const [es, en] of Object.entries(ES_TO_EN)) {
    if (text.includes(stripAccents(es))) en.split(' ').forEach(add);
  }
  if (out.length === 0) {
    // sin coincidencias: el usuario probablemente escribió en inglés
    text.split(/[^a-z]+/).filter(w => w.length > 2).forEach(add);
  }
  return out.slice(0, 8);
}

// Convierte el tema en etiquetas de búsqueda en inglés con Gemini; si falla, usa el diccionario.
async function expandTheme(theme) {
  try {
    const aiService = require('./aiService');
    // Gemini puede tardar o estar saturado: máximo 7 s y luego se usa el diccionario
    const { data } = await Promise.race([
      aiService.generateJSON({
      temperature: 0.3,
      maxOutputTokens: 400,
      prompt: 'Eres curador musical. Para el tema de un post de redes sociales, da etiquetas de búsqueda EN INGLÉS para encontrar música instrumental de fondo en bibliotecas de música libre (géneros y ánimos tipo: acoustic, warm, happy, uplifting, relaxing, family, celebration, folk, piano, guitar, chill, newyear, christmas). ' +
        'Prioriza ánimo cálido, hogareño y familiar; evita rock agresivo, electrónica dura o rap. Máximo 6 etiquetas de una sola palabra, de la más a la menos importante.\n' +
        'Responde solo JSON: {"tags":["acoustic","warm"]}\nTema: ' + String(theme).slice(0, 200)
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout IA')), 7000))
    ]);
    const tags = (Array.isArray(data.tags) ? data.tags : [])
      .map(t => stripAccents(t).replace(/[^a-z0-9]/g, '')).filter(Boolean).slice(0, 6);
    if (tags.length) return { tags, ai: true };
  } catch (_) { /* se usa el respaldo */ }
  const tags = fallbackTags(theme);
  return { tags: tags.length ? tags : ['acoustic', 'warm'], ai: false };
}

// ¿Esta licencia Creative Commons sirve para una marca? Rechaza NC (no comercial) y ND (sin derivadas: poner música a un video lo es).
function classifyLicense(urlOrName) {
  const u = String(urlOrName || '').toLowerCase();
  if (!u) return null;
  if (/-nc|noncommercial/.test(u)) return null;
  if (/-nd|noderiv/.test(u)) return null;
  if (/publicdomain\/zero|cc0|\/zero\//.test(u)) return { label: 'CC0 (dominio público)', commercialOk: true, attributionRequired: false };
  if (/publicdomain/.test(u)) return { label: 'Dominio público', commercialOk: true, attributionRequired: false };
  const m = u.match(/licenses\/(by-sa|by)\/([0-9.]+)/);
  if (m) return { label: `CC ${m[1].toUpperCase()} ${m[2]}`, commercialOk: true, attributionRequired: true };
  if (/sampling\+/.test(u)) return { label: 'CC Sampling+', commercialOk: true, attributionRequired: true };
  return null;
}

function attributionText(title, artist, license, link) {
  return `🎵 Música: "${title}" de ${artist} (${license.label})${link ? ' · ' + link : ''}`;
}

function parseDuration(ps) {
  const m = String(ps || '').match(/^(\d+):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// ccMixter responde con cabeceras más grandes que el límite por defecto de Node (axios falla con "Header overflow")
function getJsonBigHeaders(url, params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(params).toString();
    const req = http.get(url + '?' + qs, { maxHeaderSize: 512 * 1024, timeout: HTTP_TIMEOUT, headers: { 'User-Agent': 'MetaPulse/1.0' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(new Error('respuesta demasiado grande')); });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('respuesta no válida')); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// ccMixter: sin clave, trae licencia y MP3 directo.
async function searchCcMixter(tags, limit) {
  const found = [];
  const seen = new Set();
  for (const tag of tags.slice(0, 3)) {
    let list = [];
    try {
      const data = await getJsonBigHeaders('http://ccmixter.org/api/query', { f: 'json', tags: tag, limit: 40, sort: 'rank', sdir: 'DESC' });
      list = Array.isArray(data) ? data : [];
    } catch (e) { console.warn('[MusicTheme] ccMixter falló:', e.message); continue; }
    for (const r of list) {
      if (!r || seen.has(r.upload_id)) continue;
      const extra = r.upload_extra || {};
      if (String(extra.systags || '').includes('non_commercial')) continue;
      const tagsAll = ',' + String(r.upload_tags || '') + ',' + String(extra.usertags || '') + ',';
      if (/,(acappella|a_cappella|pells?|samples?|stems?|sound_effect|spoken_word),/i.test(tagsAll)) continue;
      const license = classifyLicense(r.license_url);
      if (!license) continue;
      const mp3 = (r.files || []).find(f => /\.mp3$/i.test(f.download_url || ''));
      if (!mp3) continue;
      const dur = parseDuration(mp3.file_format_info && mp3.file_format_info.ps);
      if (dur && dur < MIN_DURATION_SEC) continue;
      seen.add(r.upload_id);
      found.push({
        id: 'ccm_' + r.upload_id,
        title: r.upload_name,
        artist: r.user_real_name || r.user_name,
        streamUrl: mp3.download_url,
        durationSec: dur || 120,
        mood: String(extra.usertags || '').split(',').filter(Boolean).slice(0, 4).join(', '),
        badge: 'ccMixter',
        license: license.label,
        licenseInfo: license,
        attribution: license.attributionRequired ? attributionText(r.upload_name, r.user_real_name || r.user_name, license, r.file_page_url) : null,
        _tagHits: tags.filter(t => tagsAll.toLowerCase().includes(',' + t + ',')).length
      });
    }
  }
  return found.sort((a, b) => b._tagHits - a._tagHits).slice(0, limit);
}

// Jamendo: necesita client_id gratis. Se consulta una etiqueta por vez (varias juntas devuelven 0) y se descartan las pistas NC/ND:
// la gran mayoría de su catálogo es no comercial (en una muestra, 48 de 50), así que aporta pocas pistas aptas para una marca.
async function searchJamendoFree(tags, query, limit) {
  const clientId = getSetting('jamendo_client_id');
  if (!clientId) return { results: [], skipped: 'sin clave' };
  const results = [];
  const seen = new Set();
  let failed = 0;
  for (const tag of tags.slice(0, 4)) {
    try {
      const res = await axios.get('https://api.jamendo.com/v3.0/tracks/', {
        params: { client_id: clientId, format: 'json', limit: 100, audioformat: 'mp32', include: 'musicinfo', tags: tag, order: 'popularity_total' },
        timeout: HTTP_TIMEOUT
      });
      if (res.data && res.data.headers && res.data.headers.status === 'failed') { failed++; continue; }
      for (const t of res.data.results || []) {
        if (seen.has(t.id)) continue;
        const license = classifyLicense(t.license_ccurl);
        if (!license || !t.audio || (t.duration || 0) < MIN_DURATION_SEC) continue;
        seen.add(t.id);
        results.push({
          id: 'jam_' + t.id,
          title: t.name,
          artist: t.artist_name,
          streamUrl: t.audio,
          durationSec: t.duration,
          artworkUrl: t.image || '',
          mood: ((t.musicinfo && t.musicinfo.tags && t.musicinfo.tags.vartags) || []).slice(0, 4).join(', '),
          badge: 'Jamendo',
          license: license.label,
          licenseInfo: license,
          attribution: license.attributionRequired ? attributionText(t.name, t.artist_name, license, t.shareurl) : null
        });
      }
    } catch (e) {
      failed++;
      console.warn('[MusicTheme] Jamendo falló:', e.message);
    }
  }
  return { results: results.slice(0, limit), error: failed >= Math.min(4, tags.length) ? 'falló' : undefined };
}

// "Mi música": archivos subidos por el usuario cuyo nombre coincide con el tema (ej. "ano-nuevo-familia-pixabay.mp3").
function searchMyLibrary(theme, tags) {
  const words = new Set(
    stripAccents(theme + ' ' + tags.join(' ')).split(/[^a-z0-9]+/).filter(w => w.length > 2)
  );
  // equivalencias ES/EN para que "año nuevo" encuentre "newyear"
  for (const [es, en] of Object.entries(ES_TO_EN)) {
    if (stripAccents(theme).includes(stripAccents(es))) en.split(' ').forEach(w => words.add(stripAccents(w)));
  }
  const out = [];
  for (const a of musicService.getUserUploadedAudios()) {
    const base = stripAccents(a.filename.replace(/\.[^.]+$/, ''));
    let score = 0;
    for (const w of words) if (base.includes(w)) score++;
    if (score === 0) continue;
    out.push({
      id: 'mine_' + a.filename,
      title: a.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      artist: 'Mi música',
      streamUrl: a.relativeUrl,
      durationSec: 150,
      badge: 'Mi música',
      license: 'Tu biblioteca',
      licenseInfo: { label: 'Tu biblioteca', commercialOk: true, attributionRequired: false },
      attribution: null,
      _score: score
    });
  }
  return out.sort((a, b) => b._score - a._score);
}

async function searchByTheme({ query, limit = 20 }) {
  const theme = String(query || '').trim();
  const { tags, ai } = await expandTheme(theme);
  const mine = searchMyLibrary(theme, tags);
  const [ccm, jam, aud] = await Promise.allSettled([
    searchCcMixter(tags, limit),
    searchJamendoFree(tags, theme, limit),
    musicService.searchAudius({ query: tags.slice(0, 3).join(' '), limit: 8 })
  ]);
  const audiusList = aud.status === 'fulfilled' ? (aud.value.results || []).slice(0, 6) : [];
  const ccmList = ccm.status === 'fulfilled' ? ccm.value : [];
  const jamRes = jam.status === 'fulfilled' ? jam.value : { results: [] };

  // Se intercalan las fuentes para que no domine una sola
  const merged = [...mine];
  const a = jamRes.results.slice();
  const b = ccmList.slice();
  while (a.length || b.length) {
    if (a.length) merged.push(a.shift());
    if (b.length) merged.push(b.shift());
  }
  // Audius al final: es útil pero NO es libre de derechos (cada artista decide), por eso va sin etiqueta verde
  const results = merged.slice(0, limit).concat(audiusList).map(({ _tagHits, _score, ...t }) => t);
  return {
    source: 'theme',
    tags,
    aiTags: ai,
    jamendo: jamRes.skipped ? 'sin clave' : (jamRes.error ? 'error' : 'ok'),
    results
  };
}

module.exports = { searchByTheme, expandTheme, classifyLicense };
