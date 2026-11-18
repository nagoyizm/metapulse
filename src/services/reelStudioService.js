// Estudio de Reels: arma reels cortos 9:16 a partir de clips/imágenes descritos por el dueño.
// - plan(): la IA selecciona plantilla o guión sugerido, ordena y recorta los clips, escribe textos en pantalla, guión de voz y caption.
// - synthesizeVoice(): voz con Gemini TTS (WAV).
// - render(): FFmpeg une escenas con transiciones dinámicas (xfade), encuadre horizontal/vertical (crop o blur), textos en cápsula y música con ducking en MP4 1080x1920.
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execFile } = require('child_process');
// El ffmpeg-static de Linux viene sin drawtext (falta libharfbuzz): preferir FFMPEG_PATH o el ffmpeg del sistema (apt).
const ffmpegPath = process.env.FFMPEG_PATH
  || ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(p => fs.existsSync(p))
  || require('ffmpeg-static');
const { getSetting } = require('../database/db');
const aiService = require('./aiService');
const musicService = require('./musicService');

const ROOT = path.join(__dirname, '../..');
const REELS_DIR = path.join(ROOT, 'uploads/reels');
const TMP_DIR = path.join(REELS_DIR, 'tmp');
const FONT_BOLD = 'assets/fonts/Lato-Bold.ttf'; // fallback clásico
const W = 1080;
const H = 1920;
const FPS = 30;

// Mapeo de fuentes tipográficas para textos de Reels (FFmpeg drawtext fontfile)
const FONTS_MAP = {
  archivo: 'assets/fonts/ArchivoBlack-Regular.ttf',
  bangers: 'assets/fonts/Bangers-Regular.ttf',
  titan: 'assets/fonts/TitanOne-Regular.ttf',
  bebas: 'assets/fonts/BebasNeue-Regular.ttf',
  anton: 'assets/fonts/Anton-Regular.ttf',
  righteous: 'assets/fonts/Righteous-Regular.ttf',
  syne: 'assets/fonts/Syne-Bold.ttf',
  montserrat: 'assets/fonts/Montserrat-Bold.ttf',
  poppins: 'assets/fonts/Poppins-Bold.ttf',
  oswald: 'assets/fonts/Oswald-Bold.ttf',
  playfair: 'assets/fonts/PlayfairDisplay-Bold.ttf',
  cinzel: 'assets/fonts/Cinzel-Bold.ttf',
  caveat: 'assets/fonts/Caveat-Bold.ttf',
  lato: 'assets/fonts/Lato-Bold.ttf'
};

function getFonts() {
  return [
    { id: 'archivo', name: 'Archivo Black (Viral Hormozi / Máximo Impacto)', family: "'Archivo Black', sans-serif" },
    { id: 'bangers', name: 'Bangers (Estilo Cómic / Gancho MrBeast)', family: "'Bangers', cursive" },
    { id: 'titan', name: 'Titan One (Gruesa y Amigable / Comida & Snacks)', family: "'Titan One', cursive" },
    { id: 'bebas', name: 'Bebas Neue (Viral Reels / Punch Clásico)', family: "'Bebas Neue', sans-serif" },
    { id: 'anton', name: 'Anton (Impacto Pesado y Grueso)', family: "'Anton', sans-serif" },
    { id: 'righteous', name: 'Righteous (Retro-Moderna Punchy)', family: "'Righteous', cursive" },
    { id: 'syne', name: 'Syne (Vanguardista / Estética y Lujo)', family: "'Syne', sans-serif" },
    { id: 'montserrat', name: 'Montserrat (Moderno Geométrico Limpio)', family: "'Montserrat', sans-serif" },
    { id: 'poppins', name: 'Poppins (Amigable y Redondeado)', family: "'Poppins', sans-serif" },
    { id: 'oswald', name: 'Oswald (Condensado Dinámico)', family: "'Oswald', sans-serif" },
    { id: 'playfair', name: 'Playfair Display (Elegante Boutique)', family: "'Playfair Display', serif" },
    { id: 'cinzel', name: 'Cinzel (Cinemático Rústico)', family: "'Cinzel', serif" },
    { id: 'caveat', name: 'Caveat (Manuscrito Cálido Orgánico)', family: "'Caveat', cursive" },
    { id: 'lato', name: 'Lato (Clásico y Neutro)', family: "'Lato', sans-serif" }
  ];
}

// Catálogo de Efectos de Texto para Reels
const TEXT_EFFECTS_IN = [
  { id: 'pop', label: 'Punch / Pop (Impacto rápido)' },
  { id: 'zoomin', label: 'Zoom in (Rebote dinámico)' },
  { id: 'zoomout', label: 'Zoom desde cerca' },
  { id: 'typewriter', label: 'Máquina de escribir' },
  { id: 'wordbyword', label: 'Palabra por palabra' },
  { id: 'wind', label: 'Viento con estela' },
  { id: 'magic', label: 'Magia y destello' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'slideup', label: 'Deslizar hacia arriba' },
  { id: 'slidedown', label: 'Deslizar hacia abajo' },
  { id: 'slideleft', label: 'Deslizar desde la derecha' },
  { id: 'slideright', label: 'Deslizar desde la izquierda' },
  { id: 'drop', label: 'Caída con rebote' },
  { id: 'bounce', label: 'Rebote elástico' },
  { id: 'fade', label: 'Fundido suave' },
  { id: 'none', label: 'Corte directo' }
];

const TEXT_EFFECTS_LOOP = [
  { id: 'none', label: 'Quieto' },
  { id: 'float', label: 'Flotar' },
  { id: 'pulse', label: 'Latido suave' },
  { id: 'heartbeat', label: 'Corazón' },
  { id: 'shake', label: 'Temblor' },
  { id: 'swing', label: 'Vaivén' },
  { id: 'glow', label: 'Respirar' },
  { id: 'wave', label: 'Ola entre líneas' }
];

const TEXT_EFFECTS_OUT = [
  { id: 'fade', label: 'Fundido' },
  { id: 'zoomout', label: 'Zoom out' },
  { id: 'explode', label: 'Explosión' },
  { id: 'slideup', label: 'Deslizar hacia arriba' },
  { id: 'slidedown', label: 'Deslizar hacia abajo' },
  { id: 'slideleft', label: 'Deslizar hacia la izquierda' },
  { id: 'slideright', label: 'Deslizar hacia la derecha' },
  { id: 'wind', label: 'Viento hacia la derecha' },
  { id: 'magic', label: 'Magia y disolución' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'typewriter', label: 'Borrado máquina' },
  { id: 'drop', label: 'Caída fuera' },
  { id: 'none', label: 'Corte directo' }
];

const SPEED_OPTIONS = [
  { id: 'fast', label: 'Rápida (0.25s)', dur: 0.25 },
  { id: 'normal', label: 'Normal (0.45s)', dur: 0.45 },
  { id: 'slow', label: 'Lenta (0.8s)', dur: 0.8 }
];

const VALID_EFFECTS_IN = TEXT_EFFECTS_IN.map(e => e.id);
const VALID_EFFECTS_LOOP = TEXT_EFFECTS_LOOP.map(e => e.id);
const VALID_EFFECTS_OUT = TEXT_EFFECTS_OUT.map(e => e.id);
const VALID_SPEEDS = ['fast', 'normal', 'slow'];

function normalizeOverlay(ov) {
  if (!ov || typeof ov !== 'object') return null;
  let effectIn = ov.effectIn;
  let effectLoop = ov.effectLoop || 'none';
  let effectOut = ov.effectOut;
  let speed = ov.speed || 'normal';

  // Compatibilidad con borradores y respuestas viejas que solo traen 'effect'
  if (!effectIn && ov.effect) {
    if (ov.effect === 'pop') effectIn = 'pop';
    else if (ov.effect === 'fade') { effectIn = 'fade'; effectOut = 'fade'; }
    else if (ov.effect === 'slide') effectIn = 'slideup';
    else if (ov.effect === 'bounce') effectIn = 'bounce';
    else if (ov.effect === 'none') { effectIn = 'none'; effectOut = 'none'; }
    else effectIn = ov.effect;
  }

  if (!effectIn || !VALID_EFFECTS_IN.includes(effectIn)) effectIn = 'pop';
  if (!effectLoop || !VALID_EFFECTS_LOOP.includes(effectLoop)) effectLoop = 'none';
  if (!effectOut || !VALID_EFFECTS_OUT.includes(effectOut)) effectOut = (effectIn === 'none' ? 'none' : 'fade');
  if (!VALID_SPEEDS.includes(speed)) speed = 'normal';

  return {
    ...ov,
    effectIn,
    effectLoop,
    effectOut,
    speed
  };
}

function getTiming(start, end, speed = 'normal') {
  const dur = Math.max(0.1, (Number(end) || 0) - (Number(start) || 0));
  const baseDur = speed === 'fast' ? 0.25 : speed === 'slow' ? 0.8 : 0.45;
  const maxCombined = dur * 0.7;
  let inDur = baseDur;
  let outDur = baseDur;
  if (inDur + outDur > maxCombined) {
    inDur = maxCombined / 2;
    outDur = maxCombined / 2;
  }
  return { inDur, outDur };
}

async function measureTextWidth(text, fontFile, fontSize) {
  try {
    const sharp = require('sharp');
    const absFont = path.isAbsolute(fontFile) ? fontFile : path.resolve(ROOT, fontFile);
    if (!fs.existsSync(absFont)) return null;
    const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const pangoSize = Math.round(fontSize * 1024);
    const buf = await sharp({
      text: {
        text: `<span size="${pangoSize}">${escXml(text)}</span>`,
        fontfile: absFont,
        rgba: true
      }
    }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    if (meta && meta.width > 0) return meta.width;
  } catch (_) {}
  return null;
}

function getEntranceExpr(effectIn, pStr) {
  switch (effectIn) {
    case 'pop':
      return {
        dx: '0',
        dy: `(-35 * (1 - ${pStr}))`,
        alpha: `min(1, ${pStr} * 2.5)`,
        scale: '1'
      };
    case 'zoomin':
      return {
        dx: '0',
        dy: '0',
        alpha: `min(1, ${pStr} * 3)`,
        scale: `(0.3 + 0.7 * (1 + 1.7 * pow(${pStr} - 1, 3) + 0.7 * pow(${pStr} - 1, 2)))`
      };
    case 'zoomout':
      return {
        dx: '0',
        dy: '0',
        alpha: `min(1, ${pStr} * 2)`,
        scale: `(1.0 + 0.8 * pow(1 - ${pStr}, 2))`
      };
    case 'wind':
      return {
        dx: `(-400 * pow(1 - ${pStr}, 3))`,
        dy: '0',
        alpha: `min(1, ${pStr} * 2.5)`,
        scale: '1'
      };
    case 'magic':
      return {
        dx: '0',
        dy: '0',
        alpha: `if(lt(${pStr}, 0.8), 0.3 + 0.7 * abs(sin(${pStr} * 18.84)), 1)`,
        scale: `(0.7 + 0.3 * (1 - pow(1 - ${pStr}, 2)))`
      };
    case 'glitch':
      return {
        dx: `(8 * sin(${pStr} * 62.83) * (1 - ${pStr}))`,
        dy: '0',
        alpha: `min(1, ${pStr} * 3)`,
        scale: '1'
      };
    case 'slideup':
      return {
        dx: '0',
        dy: `(120 * pow(1 - ${pStr}, 3))`,
        alpha: `min(1, ${pStr} * 2)`,
        scale: '1'
      };
    case 'slidedown':
      return {
        dx: '0',
        dy: `(-120 * pow(1 - ${pStr}, 3))`,
        alpha: `min(1, ${pStr} * 2)`,
        scale: '1'
      };
    case 'slideleft':
      return {
        dx: `(250 * pow(1 - ${pStr}, 3))`,
        dy: '0',
        alpha: `min(1, ${pStr} * 2)`,
        scale: '1'
      };
    case 'slideright':
      return {
        dx: `(-250 * pow(1 - ${pStr}, 3))`,
        dy: '0',
        alpha: `min(1, ${pStr} * 2)`,
        scale: '1'
      };
    case 'drop':
      return {
        dx: '0',
        dy: `(-600 * abs(cos(${pStr} * 4.71)) * pow(1 - ${pStr}, 2))`,
        alpha: `min(1, ${pStr} * 4)`,
        scale: '1'
      };
    case 'bounce':
      return {
        dx: '0',
        dy: `(-25 * sin(min(3.14159, ${pStr} * 3.14159)))`,
        alpha: `min(1, ${pStr} * 3)`,
        scale: `(1 + 0.15 * sin(min(3.14159, ${pStr} * 3.14159)))`
      };
    case 'fade':
      return {
        dx: '0',
        dy: '0',
        alpha: pStr,
        scale: '1'
      };
    case 'typewriter':
    case 'wordbyword':
    case 'none':
    default:
      return {
        dx: '0',
        dy: '0',
        alpha: '1',
        scale: '1'
      };
  }
}

function getLoopExpr(effectLoop, lineIdx = 0) {
  switch (effectLoop) {
    case 'float':
      return {
        dx: '0',
        dy: '10 * sin(2.85599 * t)',
        alpha: '1',
        scale: '1'
      };
    case 'pulse':
      return {
        dx: '0',
        dy: '0',
        alpha: '1',
        scale: '1 + 0.04 * sin(5.23599 * t)'
      };
    case 'heartbeat':
      return {
        dx: '0',
        dy: '0',
        alpha: '1',
        scale: '1 + if(lt(mod(t, 1), 0.18), 0.06 * sin(mod(t, 1) * 17.45), if(between(mod(t, 1), 0.22, 0.40), 0.04 * sin((mod(t, 1) - 0.22) * 17.45), 0))'
      };
    case 'shake':
      return {
        dx: '4 * sin(t * 50)',
        dy: '0',
        alpha: '1',
        scale: '1'
      };
    case 'swing':
      return {
        dx: '14 * sin(3.92699 * t)',
        dy: '0',
        alpha: '1',
        scale: '1'
      };
    case 'glow':
      return {
        dx: '0',
        dy: '0',
        alpha: '0.9 + 0.1 * sin(4.18879 * t)',
        scale: '1'
      };
    case 'wave':
      return {
        dx: '0',
        dy: `10 * sin(2.85599 * t + ${(lineIdx * 1.2).toFixed(2)})`,
        alpha: '1',
        scale: '1'
      };
    case 'none':
    default:
      return {
        dx: '0',
        dy: '0',
        alpha: '1',
        scale: '1'
      };
  }
}

function getExitExpr(effectOut, qStr) {
  switch (effectOut) {
    case 'zoomout':
      return {
        dx: '0',
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: `max(0.01, 1 - ${qStr})`
      };
    case 'explode':
      return {
        dx: '0',
        dy: '0',
        alpha: `max(0, 1 - pow(${qStr}, 2))`,
        scale: `(1 + 0.6 * ${qStr})`
      };
    case 'slideup':
      return {
        dx: '0',
        dy: `(-120 * pow(${qStr}, 2))`,
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'slidedown':
      return {
        dx: '0',
        dy: `(120 * pow(${qStr}, 2))`,
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'slideleft':
      return {
        dx: `(-250 * pow(${qStr}, 2))`,
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'slideright':
      return {
        dx: `(250 * pow(${qStr}, 2))`,
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'wind':
      return {
        dx: `(400 * pow(${qStr}, 2))`,
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'magic':
      return {
        dx: '0',
        dy: '0',
        alpha: `((1 - ${qStr}) * (0.5 + 0.5 * abs(sin(${qStr} * 18.84))))`,
        scale: `max(0.01, 1 - 0.3 * ${qStr})`
      };
    case 'glitch':
      return {
        dx: `(8 * sin(${qStr} * 62.83) * ${qStr})`,
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'drop':
      return {
        dx: '0',
        dy: `(600 * pow(${qStr}, 2))`,
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'fade':
      return {
        dx: '0',
        dy: '0',
        alpha: `(1 - ${qStr})`,
        scale: '1'
      };
    case 'typewriter':
    case 'none':
    default:
      return {
        dx: '0',
        dy: '0',
        alpha: '1',
        scale: '1'
      };
  }
}

function composeValue(inVal, loopVal, outVal, tInEnd, tOut0) {
  if (inVal === loopVal && loopVal === outVal) return inVal;
  return `if(lt(t, ${tInEnd.toFixed(2)}), ${inVal}, if(lt(t, ${tOut0.toFixed(2)}), ${loopVal}, ${outVal}))`;
}

// Voces de Gemini TTS elegibles (nombre oficial -> cómo suena)
const VOICES = [
  { id: 'Sulafat', label: 'Sulafat', desc: 'Cálida y cercana (recomendada)' },
  { id: 'Achird', label: 'Achird', desc: 'Amistosa, como un vecino simpático' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix', desc: 'Suave y amable' },
  { id: 'Leda', label: 'Leda', desc: 'Juvenil y fresca' },
  { id: 'Aoede', label: 'Aoede', desc: 'Ligera y alegre' },
  { id: 'Puck', label: 'Puck', desc: 'Animada, con energía' },
  { id: 'Algieba', label: 'Algieba', desc: 'Fluida y serena' },
  { id: 'Charon', label: 'Charon', desc: 'Voz masculina informativa y tranquila' },
  { id: 'Orus', label: 'Orus', desc: 'Voz masculina firme y confiable' }
];

const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts', 'gemini-3.1-flash-tts-preview'];

// Plantillas de Guiones Virales
const TEMPLATES = [
  {
    id: 'review',
    title: 'Reseña de Producto / Prueba',
    desc: 'Gancho llamativo (0-2s) ➔ Textura o detalle (2-6s) ➔ Veredicto y ubicación (6-10s)',
    recommendedFor: 'Kmarket Algarrobo (snacks, helados, ramen, bebidas)'
  },
  {
    id: 'top3',
    title: 'Top 3 / Lista Rápida',
    desc: 'Gancho de lista (0-2s) ➔ Punto 1 ➔ Punto 2 ➔ Punto 3 ➔ Llamado a guardar/enviar',
    recommendedFor: 'Ambas marcas (productos favoritos, rincones de La Campiña)'
  },
  {
    id: 'atmosphere',
    title: 'Atmósfera y Recorrido',
    desc: 'Detalle sensorial (0-2s) ➔ Espacio amplio (2-7s) ➔ Momento acogedor ➔ Reservas WhatsApp',
    recommendedFor: 'Cabañas La Campiña (bosque, quinchos, cabañas, silencio)'
  },
  {
    id: 'promo',
    title: 'Novedad o Temporada',
    desc: 'Titular directo ➔ Demostración rápida de lo que llegó o queda ➔ Dónde conseguirlo',
    recommendedFor: 'Nuevos productos, fechas festivas, ofertas del mes'
  },
  {
    id: 'custom',
    title: 'Guion Personalizado',
    desc: 'Escribe o pega tu propio guion o sugerencia y la IA distribuirá las tomas',
    recommendedFor: 'Cualquier idea específica que tengas en mente'
  }
];

const VALID_XFADE_TRANSITIONS = [
  'zoomin',
  'slideleft',
  'slideright',
  'smoothleft',
  'smoothright',
  'fadewhite',
  'fadeblack',
  'dissolve',
  'fade'
];

function ensureDirs() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function localPath(urlOrPath) {
  const clean = String(urlOrPath || '').split('?')[0].replace(/^[\\/]+/, '');
  const abs = path.resolve(ROOT, clean);
  if (!abs.startsWith(path.resolve(ROOT, 'uploads')) && !abs.startsWith(path.resolve(ROOT, 'public'))) {
    throw new Error('Ruta de archivo no permitida: ' + urlOrPath);
  }
  if (!fs.existsSync(abs)) throw new Error('No existe el archivo: ' + urlOrPath);
  return abs;
}

function isImage(p) {
  return /\.(jpe?g|png|webp|gif)$/i.test(p);
}

function runFFmpeg(args, timeoutMs = 240000) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { cwd: ROOT, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error('FFmpeg: ' + String(stderr || err.message).slice(-600)));
      resolve({ stdout, stderr });
    });
  });
}

// Duración en segundos leyendo la salida de "ffmpeg -i" (no hay ffprobe)
async function probeDuration(absPath) {
  if (isImage(absPath)) return 0;
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-i', absPath], { timeout: 30000 }, (err, stdout, stderr) => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(stderr));
      resolve(m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0);
    });
  });
}

function wordsPerSecond() {
  return 2.4;
}

function brandRulesFor(brand = '') {
  const lower = String(brand).toLowerCase();
  const isKmarket = lower.includes('kmarket');
  const isCampina = lower.includes('campi');
  return isKmarket
    ? 'Marca: Kmarket Algarrobo, tienda de snacks, helados, ramen y bebidas coreanas empaquetadas (NO es carnicería ni restaurante). Tono cercano, apetitoso y sobrio. El caption DEBE terminar con la dirección: "📍 Encuéntralo en Kmarket Algarrobo\\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo" y 3-5 hashtags incluyendo #KmarketAlgarrobo #KFood.'
    : isCampina
      ? 'Marca: Cabañas La Campiña (Algarrobo): cabañas rústicas familiares, quinchos con parrilla, pinos y jardines. CERO tinajas, jacuzzis ni hot tubs. Tono cálido y familiar. El caption invita a escribir por WhatsApp para reservar y lleva 3-5 hashtags.'
      : `Marca: ${brand || 'la marca'}. Tono cercano y claro.`;
}

// ───────────────────── Análisis Multimodal de un Clip ─────────────────────
async function analyzeClip({ url, brand = '', goal = '', force = false }) {
  if (!url) throw new Error('Se requiere el parámetro url del clip');
  const abs = localPath(url);
  const stat = fs.statSync(abs);
  const parsedPath = path.parse(abs);
  const cachePath = path.join(parsedPath.dir, `${parsedPath.name}.analysis.json`);

  if (!force && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cached && cached.fileSize === stat.size) {
        const { fileSize, ...rest } = cached;
        return rest;
      }
    } catch (_) {}
  }

  const isVid = !isImage(abs);
  let duration = 0;
  const images = [];
  const tmpFiles = [];

  try {
    if (isVid) {
      const dur = await probeDuration(abs);
      duration = Math.round(dur * 10) / 10;
      const n = Math.min(12, Math.max(4, Math.ceil(dur || 1)));
      ensureDirs();
      const tMin = Math.min(0.2, (dur || 1) * 0.1);
      const tMax = Math.max(tMin, (dur || 1) - 0.2);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? tMin : tMin + (i / (n - 1)) * (tMax - tMin);
        const tmpPath = path.join(TMP_DIR, `frame_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}.jpg`);
        tmpFiles.push(tmpPath);
        await runFFmpeg(['-ss', t.toFixed(3), '-i', abs, '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '5', '-y', tmpPath]);
        if (fs.existsSync(tmpPath)) {
          const buf = fs.readFileSync(tmpPath);
          images.push({
            mime_type: 'image/jpeg',
            data: buf.toString('base64'),
            label: `Cuadro en el segundo ${t.toFixed(1)}`
          });
        }
      }
    } else {
      const sharp = require('sharp');
      const buf = await sharp(abs)
        .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      images.push({
        mime_type: 'image/jpeg',
        data: buf.toString('base64'),
        label: 'Fotografía'
      });
    }
  } finally {
    for (const f of tmpFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    }
  }

  const brandRules = brandRulesFor(brand);
  const prompt = `Eres un editor experto de reels verticales para Instagram y TikTok.
Analiza este clip audiovisual para la marca.

${brandRules}
${goal ? `OBJETIVO DEL REEL: ${goal}` : ''}
${isVid ? `DURACIÓN DEL CLIP: ${duration} segundos.` : 'TIPO DE ARCHIVO: Fotografía / imagen fija.'}

Analiza las imágenes proporcionadas y extrae la información en formato JSON estricto:
{
  "description": "qué se ve, 1-2 frases concretas (sujeto, acción, lugar)",
  "subject": "sujeto principal",
  "mood": "cálido | enérgico | tranquilo | apetitoso | ...",
  "shotType": "primer plano | plano medio | general | detalle | ...",
  "highlights": [ { "start": 6.0, "end": 9.0, "label": "primer plano del ramen humeante", "score": 9 } ],
  "hook": { "start": 6.0, "end": 7.5, "why": "por qué este momento funciona como gancho inicial" },
  "framing": { "panX": 0.5, "panY": 0.45, "zoom": 1.0, "fitMode": "crop" },
  "issues": ["movido entre 2 y 3 s", "oscuro al inicio"],
  "textIdeas": ["RAMEN EN 3 MINUTOS", "..."]
}

REGLAS DE ANÁLISIS:
- highlights: tramos destacados de 1.5 a 4.0 segundos, máximo 4, contenidos dentro de la duración (${duration}s) y ordenados por score descendente (1-10).
- hook: el tramo de mayor impacto inicial (1.0 a 3.0 segundos) dentro de la duración.
- framing: panX y panY (números entre 0.0 y 1.0) indican la posición del sujeto principal en el cuadro para recortar a formato vertical 9:16 (0.5 = centro); zoom (número >= 1.0, default 1.0); fitMode: "crop" por defecto para llenar 9:16 vertical, o "blur" únicamente si es un paisaje amplio o plano panorámico que no se debe recortar.
- No inventar lo que no se ve en las imágenes.
- Cumplir estrictamente las reglas de la marca (ej. en La Campiña: CERO tinajas, jacuzzis ni hot tubs aunque parezca que hay).
- textIdeas: máximo 4 ideas de texto en pantalla, cortas (de 2 a 6 palabras), contundentes, en mayúsculas, sin emojis.
- Devuelve ESTRICTAMENTE JSON sin texto adicional ni markdown.`;

  const { data: raw, model } = await aiService.generateJSONWithImages({
    prompt,
    images,
    temperature: 0.3,
    maxOutputTokens: 2048
  });

  const description = String(raw?.description || '').slice(0, 300);
  const subject = String(raw?.subject || '').slice(0, 100);
  const mood = String(raw?.mood || '').slice(0, 60);
  const shotType = String(raw?.shotType || '').slice(0, 60);

  const rawHighlights = Array.isArray(raw?.highlights) ? raw.highlights : [];
  const highlights = rawHighlights.map((h) => {
    let hStart = Math.max(0, Number(h.start) || 0);
    let hEnd = Number(h.end) || (hStart + 2.0);
    if (isVid && duration > 0) {
      if (hStart >= duration) return null;
      hEnd = Math.min(duration, Math.max(hStart + 0.5, hEnd));
    }
    if (hEnd <= hStart) return null;
    const score = Math.min(10, Math.max(1, Math.round(Number(h.score) || 7)));
    const label = String(h.label || '').slice(0, 100);
    return {
      start: Math.round(hStart * 10) / 10,
      end: Math.round(hEnd * 10) / 10,
      label,
      score
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);

  let hook = null;
  if (raw?.hook && typeof raw.hook === 'object') {
    let hkStart = Math.max(0, Number(raw.hook.start) || 0);
    let hkEnd = Number(raw.hook.end) || (hkStart + 2.0);
    if (isVid && duration > 0) {
      if (hkStart >= duration) hkStart = 0;
      hkEnd = Math.min(duration, Math.max(hkStart + 0.5, hkEnd));
    }
    hook = {
      start: Math.round(hkStart * 10) / 10,
      end: Math.round(hkEnd * 10) / 10,
      why: String(raw.hook.why || '').slice(0, 200)
    };
  } else if (highlights.length > 0) {
    hook = {
      start: highlights[0].start,
      end: highlights[0].end,
      why: highlights[0].label
    };
  } else {
    hook = {
      start: 0,
      end: Math.min(2.5, duration || 2.5),
      why: 'Inicio del clip'
    };
  }

  const rawFraming = raw?.framing || {};
  const panX = typeof rawFraming.panX === 'number' ? Math.min(1, Math.max(0, rawFraming.panX)) : 0.5;
  const panY = typeof rawFraming.panY === 'number' ? Math.min(1, Math.max(0, rawFraming.panY)) : 0.5;
  const zoom = typeof rawFraming.zoom === 'number' ? Math.min(3, Math.max(1, rawFraming.zoom)) : 1.0;
  const fitMode = rawFraming.fitMode === 'blur' ? 'blur' : 'crop';
  const framing = {
    panX: Math.round(panX * 100) / 100,
    panY: Math.round(panY * 100) / 100,
    zoom: Math.round(zoom * 10) / 10,
    fitMode
  };

  const issues = (Array.isArray(raw?.issues) ? raw.issues : [])
    .map(s => String(s || '').slice(0, 100))
    .filter(Boolean)
    .slice(0, 5);

  const textIdeas = (Array.isArray(raw?.textIdeas) ? raw.textIdeas : [])
    .map(t => {
      const words = String(t || '').trim().replace(/\s+/g, ' ').split(' ');
      if (words.length < 2) return null;
      return words.slice(0, 6).join(' ').toUpperCase();
    })
    .filter(Boolean)
    .slice(0, 4);

  const result = {
    description,
    subject,
    mood,
    shotType,
    highlights,
    hook,
    framing,
    issues,
    textIdeas,
    duration,
    analyzedAt: new Date().toISOString(),
    model: model || 'gemini'
  };

  try {
    fs.writeFileSync(cachePath, JSON.stringify({ ...result, fileSize: stat.size }, null, 2), 'utf8');
  } catch (cErr) {
    console.warn('[analyzeClip] Error escribiendo cache:', cErr.message);
  }

  return result;
}

// ───────────────────── Sugerencias del Conjunto de Clips ─────────────────────
async function reviewClips({ brand = '', goal = '', template = 'auto', targetSeconds = 12, clips = [] }) {
  const brandRules = brandRulesFor(brand);
  const prompt = `Eres un director y editor experto de reels verticales para Instagram y TikTok.
Analiza este conjunto de clips disponibles y sugiere la mejor estructura para el reel.

${brandRules}
${goal ? `OBJETIVO INDICADO POR EL DUEÑO: ${goal}` : ''}
FÓRMULA ACTUAL SELECCIONADA: ${template}
DURACIÓN OBJETIVO PREVISTA: ${targetSeconds} segundos.

CLIPS DISPONIBLES:
${JSON.stringify(clips.map((c, i) => ({
  index: c.index !== undefined ? c.index : i,
  description: c.description || c.analysis?.description || '',
  analysis: c.analysis ? {
    subject: c.analysis.subject,
    mood: c.analysis.mood,
    shotType: c.analysis.shotType,
    highlights: c.analysis.highlights,
    hook: c.analysis.hook,
    issues: c.analysis.issues
  } : null
})), null, 2)}

Devuelve ESTRICTAMENTE un JSON con:
{
  "hookClip": 0,
  "recommendedTemplate": "review | top3 | atmosphere | promo",
  "recommendedSeconds": 12,
  "missingShots": ["un plano de cierre con el local o el logo"],
  "tips": ["el clip 1 está oscuro: úsalo poco"],
  "goalIdea": "objetivo sugerido si el dueño no escribió uno"
}

REGLAS:
- hookClip: índice (0-based) del clip con el gancho más potente para abrir el video.
- recommendedTemplate: el id de la fórmula narrativa ideal entre "review", "top3", "atmosphere", "promo".
- recommendedSeconds: duración total recomendada en segundos (entre 8 y 20).
- missingShots: lista de 1 a 3 planos o tomas que faltan para completar la historia.
- tips: 1 a 3 consejos concretos de edición basados en la calidad y contenido de los clips.
- goalIdea: si el dueño no escribió objetivo, una frase clara con el objetivo sugerido; si ya lo escribió, un complemento breve.`;

  const { data: raw } = await aiService.generateJSON({ prompt, temperature: 0.5 });

  const maxClipIdx = Math.max(0, clips.length - 1);
  const hookClip = Math.min(maxClipIdx, Math.max(0, parseInt(raw?.hookClip, 10) || 0));
  const validTemplates = ['review', 'top3', 'atmosphere', 'promo'];
  const recommendedTemplate = validTemplates.includes(raw?.recommendedTemplate)
    ? raw.recommendedTemplate
    : (String(brand).toLowerCase().includes('campi') ? 'atmosphere' : 'review');
  const recommendedSeconds = Math.min(25, Math.max(6, Number(raw?.recommendedSeconds) || Number(targetSeconds) || 12));

  const missingShots = (Array.isArray(raw?.missingShots) ? raw.missingShots : [])
    .map(s => String(s || '').slice(0, 150))
    .filter(Boolean)
    .slice(0, 4);

  const tips = (Array.isArray(raw?.tips) ? raw.tips : [])
    .map(s => String(s || '').slice(0, 150))
    .filter(Boolean)
    .slice(0, 4);

  const goalIdea = String(raw?.goalIdea || '').slice(0, 150);

  return {
    hookClip,
    recommendedTemplate,
    recommendedSeconds,
    missingShots,
    tips,
    goalIdea
  };
}

// ───────────────────────── Plan con IA ─────────────────────────
async function plan({ brand = '', clips = [], goal = '', targetSeconds = 10, template = 'auto', customScript = '' }) {
  if (!clips.length) throw new Error('Agrega al menos un clip o imagen.');
  const target = Math.min(Math.max(Number(targetSeconds) || 10, 6), 25);

  const described = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const abs = localPath(c.url);
    const dur = await probeDuration(abs);
    const userDesc = String(c.description || '').trim();
    const item = {
      index: i,
      url: c.url,
      kind: isImage(abs) ? 'imagen' : 'video',
      duration: dur ? Math.round(dur * 10) / 10 : null,
      description: (userDesc || (c.analysis && c.analysis.description) || '').slice(0, 300)
    };
    if (c.analysis) {
      item.analysis = {
        description: c.analysis.description || '',
        highlights: Array.isArray(c.analysis.highlights) ? c.analysis.highlights : [],
        hook: c.analysis.hook || null,
        shotType: c.analysis.shotType || '',
        mood: c.analysis.mood || '',
        issues: Array.isArray(c.analysis.issues) ? c.analysis.issues : []
      };
    }
    described.push(item);
  }

  const brandRules = brandRulesFor(brand);

  let templateDirective = '';
  if (customScript && customScript.trim()) {
    templateDirective = `\nGUION SUGERIDO POR EL USUARIO (DEBES RESPETAR Y ASIGNAR LOS CLIPS A ESTE GUION):\n"""\n${customScript.trim()}\n"""\n`;
  } else if (template && template !== 'auto') {
    const matched = TEMPLATES.find(t => t.id === template);
    if (matched) {
      templateDirective = `\nFÓRMULA NARRATIVA SELECCIONADA: "${matched.title}"\nEstructura: ${matched.desc}\n`;
    }
  }

  const prompt = `Eres un editor de reels de Instagram/Facebook y TikTok de alto rendimiento y viralidad.
Tu misión es armar un reel vertical de ${target} segundos (máximo ${target + 3}) con estos clips del dueño.
SEPARANDO CLARAMENTE dos capas:
1. PISTA DE VIDEO: la secuencia de tomas (cortes de clips, duración de cada toma, encuadres y transiciones dinámicas).
2. PISTA DE TEXTOS (OVERLAYS): textos en pantalla que flotan independientemente sobre el video, con sus propios tiempos de inicio y fin (pueden durar más que una sola toma y atravesar cortes de video), tipografía viral, estilo y animación.

${brandRules}
${templateDirective}
OBJETIVO DEL REEL: ${goal || 'mostrar el producto/lugar con ritmo ágil y provocar que lo compartan o guarden'}

CLIPS DISPONIBLES (índice, tipo, duración, descripción del dueño):
${JSON.stringify(described, null, 1)}

REGLAS DE EDICIÓN:
1. Pista de Video:
   - Toma 1 = GANCHO VISUAL potente que detiene el scroll en los primeros 1.5 segundos. La toma 1 usa el hook del clip más fuerte.
   - Si un clip trae highlights, elige start/length dentro de ellos; evita los tramos con issues.
   - Cada toma usa un clip (start y length en segundos). Tomas dinámicas de 1.5 a 3.5 segundos.
   - "transition": sugiere la transición hacia la siguiente toma entre "zoomin", "slideleft", "fadewhite", "smoothleft", "dissolve" o "none".
   - "fitMode": "crop" (llena pantalla vertical 9:16) o "blur" (fondo borroso para planos amplios que no se deben recortar).

2. Pista de Textos en Pantalla (Overlays independientes):
   - Textos de 2 a 6 palabras, en mayúsculas, contundentes, sin emojis.
   - Cada texto tiene su tiempo global en segundos: "start" (segundo de aparición) y "end" (segundo de desaparición).
   - Un texto puede abarcar una o varias tomas (ej: texto 1 de 0.0s a 3.0s; texto 2 de 3.0s a 6.0s; texto 3 de 6.0s a ${target}.0s).
   - "pos": "top", "center" o "bottom".
   - "textStyle": "yellow" (cápsula amarilla viral TikTok/Reels), "pill" (cápsula oscura), "impact" (borde grueso estilo Hormozi), "neon" (resplandor neón) o "minimal" (sombra limpia).
   - "font": "archivo" (Hormozi / impacto), "bangers" (cómic / MrBeast), "titan" (comida / amigable), "bebas" (clásica), "anton", "righteous", "syne", "montserrat", "poppins", "oswald", "playfair", "cinzel", "caveat", "lato".
   - "effectIn": entrada del texto entre "pop", "zoomin", "zoomout", "typewriter", "wordbyword", "wind", "magic", "glitch", "slideup", "slidedown", "slideleft", "slideright", "drop", "bounce", "fade", "none".
   - "effectLoop": animación continua entre "none", "float", "pulse", "heartbeat", "shake", "swing", "glow", "wave".
   - "effectOut": salida del texto entre "fade", "zoomout", "explode", "slideup", "slidedown", "slideleft", "slideright", "wind", "magic", "glitch", "typewriter", "drop", "none".
   - "speed": "fast" (0.25s), "normal" (0.45s) o "slow" (0.8s).
   Guía de dinamismo: gancho inicial -> zoomin/glitch/magic; listas -> wordbyword; cierre/CTA -> pop + pulse; atmósfera -> fade + float.

3. "voiceover": guion hablado conciso en español chileno neutro, máx ${Math.round(target * wordsPerSecond())} palabras.
4. "caption": texto para pie de publicación de Instagram con gancho en primera línea y hashtags al final.
5. "musicQuery": 2 a 4 palabras clave para música de fondo (ej: "kpop upbeat" o "acoustic warm nature").

Devuelve ESTRICTAMENTE JSON con esta estructura:
{
  "title": "nombre interno corto",
  "scenes": [
    {
      "clip": 0,
      "start": 0,
      "length": 2.5,
      "transition": "zoomin",
      "fitMode": "crop"
    }
  ],
  "textOverlays": [
    {
      "text": "GANCHO EN 3 PALABRAS",
      "start": 0.0,
      "end": 3.0,
      "pos": "top",
      "textStyle": "yellow",
      "font": "archivo",
      "effectIn": "zoomin",
      "effectLoop": "none",
      "effectOut": "fade",
      "speed": "normal"
    }
  ],
  "voiceover": "...",
  "caption": "...",
  "musicQuery": "..."
}`;

  const { data } = await aiService.generateJSON({ prompt, temperature: 0.7, maxOutputTokens: 4096 });
  const rawScenes = Array.isArray(data.scenes) ? data.scenes : [];

  let accumTime = 0;
  const scenes = rawScenes.map((s, idx) => {
    const clipIdx = Math.min(Math.max(parseInt(s.clip, 10) || 0, 0), clips.length - 1);
    const info = described[clipIdx];
    let length = Math.min(Math.max(Number(s.length) || 2.5, 1), 6);
    let start = Math.max(Number(s.start) || 0, 0);
    if (info.duration) {
      if (start >= info.duration - 0.5) start = 0;
      length = Math.min(length, Math.max(info.duration - start, 0.8));
    } else {
      start = 0;
    }

    const defaultTransitions = ['zoomin', 'slideleft', 'fadewhite', 'smoothleft'];
    const assignedTransition = VALID_XFADE_TRANSITIONS.includes(s.transition)
      ? s.transition
      : defaultTransitions[idx % defaultTransitions.length];

    let fitMode = s.fitMode === 'blur' ? 'blur' : 'crop';
    let zoom = 1.0;
    let panX = 0.5;
    let panY = 0.5;

    // Post-proceso: si la toma de un clip con analysis.framing queda con zoom 1 y pan 0.5 por defecto, aplicarle framing
    const origClip = clips[clipIdx];
    const framing = origClip?.analysis?.framing;
    if (framing && zoom === 1.0 && panX === 0.5 && panY === 0.5) {
      if (typeof framing.panX === 'number') panX = Math.min(1, Math.max(0, framing.panX));
      if (typeof framing.panY === 'number') panY = Math.min(1, Math.max(0, framing.panY));
      if (typeof framing.zoom === 'number') zoom = Math.min(3, Math.max(1, framing.zoom));
      if (framing.fitMode === 'blur' || framing.fitMode === 'crop') fitMode = framing.fitMode;
    }

    const scObj = {
      clip: clipIdx,
      url: info.url,
      kind: info.kind,
      start: Math.round(start * 10) / 10,
      length: Math.round(length * 10) / 10,
      text: String(s.text || '').slice(0, 60),
      pos: ['top', 'center', 'bottom'].includes(s.pos) ? s.pos : 'center',
      textStyle: ['pill', 'minimal', 'impact', 'yellow', 'neon'].includes(s.textStyle) ? s.textStyle : 'pill',
      font: s.font && FONTS_MAP[s.font] ? s.font : 'archivo',
      fitMode,
      zoom,
      panX,
      panY,
      transition: assignedTransition
    };
    accumTime += scObj.length;
    return scObj;
  }).filter(s => s.url);

  if (!scenes.length) throw new Error('La IA no devolvió escenas utilizables. Intenta de nuevo con descripciones más claras.');

  const totalEstDuration = accumTime;
  const rawOverlays = Array.isArray(data.textOverlays) ? data.textOverlays : [];
  let textOverlays = rawOverlays.map((ov, idx) => {
    const oStart = Math.max(0, Number(ov.start) || (idx * 2.8));
    const oEnd = Math.min(totalEstDuration, Math.max(oStart + 0.8, Number(ov.end) || (oStart + 2.8)));
    return normalizeOverlay({
      id: `ov_${idx + 1}`,
      text: String(ov.text || '').slice(0, 70),
      start: Math.round(oStart * 10) / 10,
      end: Math.round(oEnd * 10) / 10,
      pos: ['top', 'center', 'bottom'].includes(ov.pos) ? ov.pos : (idx === 0 ? 'top' : idx === 1 ? 'center' : 'bottom'),
      textStyle: ['pill', 'minimal', 'impact', 'yellow', 'neon'].includes(ov.textStyle) ? ov.textStyle : (idx === 0 ? 'yellow' : 'pill'),
      font: ov.font && FONTS_MAP[ov.font] ? ov.font : 'archivo',
      effect: ov.effect,
      effectIn: ov.effectIn,
      effectLoop: ov.effectLoop,
      effectOut: ov.effectOut,
      speed: ov.speed
    });
  }).filter(ov => ov && ov.text);

  // Fallback si la IA no entregó textOverlays pero sí escenas con texto
  if (!textOverlays.length) {
    let tOffset = 0;
    textOverlays = scenes.map((s, idx) => {
      const start = tOffset;
      const end = tOffset + s.length;
      tOffset = end;
      return normalizeOverlay({
        id: `ov_${idx + 1}`,
        text: s.text || (idx === 0 ? 'MIRA ESTO' : idx === 1 ? 'EL DETALLE QUE BUSCABAS' : 'VEN A CONOCERLO'),
        start: Math.round(start * 10) / 10,
        end: Math.round(end * 10) / 10,
        pos: s.pos || 'center',
        textStyle: s.textStyle || 'pill',
        font: s.font || 'archivo',
        effectIn: 'pop',
        effectLoop: 'none',
        effectOut: 'fade',
        speed: 'normal'
      });
    });
  }

  let caption = String(data.caption || '');
  try { caption = aiService.cleanCaptionAI(caption); } catch (_) {}

  return {
    title: String(data.title || 'Reel').slice(0, 80),
    scenes,
    textOverlays,
    voiceover: String(data.voiceover || '').trim(),
    caption,
    musicQuery: String(data.musicQuery || '').trim()
  };
}

// ───────────────────── Sugerir Textos con IA (Paso 4) ─────────────────────
async function suggestTextOverlays({ brand = '', scenes = [], clips = [], goal = '', voiceover = '' }) {
  const totalEstDuration = scenes.reduce((acc, s) => acc + (Number(s.length) || 0), 0) || 10;
  const lower = String(brand).toLowerCase();
  const isKmarket = lower.includes('kmarket');
  const isCampina = lower.includes('campi');
  const brandRules = isKmarket
    ? 'Marca: Kmarket Algarrobo (tienda de snacks, golosinas y ramen coreano).'
    : isCampina
      ? 'Marca: Cabañas La Campiña (Algarrobo: descanso familiar campestre).'
      : `Marca: ${brand || 'la marca'}.`;

  const prompt = `Eres un editor de reels virales en TikTok e Instagram experto en ganchos de texto de alto impacto (estilo Alex Hormozi / MrBeast).
El video dura un total de ${totalEstDuration.toFixed(1)} segundos y tiene ${scenes.length} tomas de video.
${brandRules}
Objetivo: ${goal || 'retención, viralidad y llamado a la acción'}
Guion de voz actual: "${voiceover || 'Sin locución'}"

Genera una lista de 2 a 4 textos independientes (overlays) que aparezcan sobre el video a lo largo de su duración total (${totalEstDuration.toFixed(1)} s).
REGLAS:
- Textos cortos de 2 a 5 palabras, en MAYÚSCULAS, contundentes, sin signos ni emojis (ej: "MIRA ESTE HELADO", "RELLENO CREMOSO", "SOLO EN KMARKET").
- "start" y "end" en segundos flotantes dentro de 0.0 y ${totalEstDuration.toFixed(1)}. Los textos pueden durar de 2 a 3.5 segundos cada uno.
- "pos": "top", "center" o "bottom".
- "textStyle": "yellow" (cápsula amarilla viral TikTok/Reels), "pill" (cápsula oscura), "impact" (borde de impacto), "neon" o "minimal".
- "font": "archivo" (Hormozi), "bangers" (cómic), "titan" (comida), "bebas", "anton", "righteous", "syne", "montserrat", "poppins".
- "effectIn": entrada del texto entre "pop", "zoomin", "zoomout", "typewriter", "wordbyword", "wind", "magic", "glitch", "slideup", "slidedown", "slideleft", "slideright", "drop", "bounce", "fade", "none".
- "effectLoop": animación continua entre "none", "float", "pulse", "heartbeat", "shake", "swing", "glow", "wave".
- "effectOut": salida del texto entre "fade", "zoomout", "explode", "slideup", "slidedown", "slideleft", "slideright", "wind", "magic", "glitch", "typewriter", "drop", "none".
- "speed": "fast" (0.25s), "normal" (0.45s) o "slow" (0.8s).
Guía de dinamismo: gancho inicial -> zoomin/glitch/magic; listas -> wordbyword; cierre/CTA -> pop + pulse; atmósfera -> fade + float.

Devuelve ESTRICTAMENTE JSON con este formato:
{
  "textOverlays": [
    {
      "text": "GANCHO DE IMPACTO",
      "start": 0.0,
      "end": 2.8,
      "pos": "top",
      "textStyle": "yellow",
      "font": "archivo",
      "effectIn": "zoomin",
      "effectLoop": "none",
      "effectOut": "fade",
      "speed": "normal"
    }
  ]
}`;

  const { data } = await aiService.generateJSON({ prompt, temperature: 0.7, maxOutputTokens: 2048 });
  const rawOverlays = Array.isArray(data.textOverlays) ? data.textOverlays : [];
  const textOverlays = rawOverlays.map((ov, idx) => {
    const oStart = Math.max(0, Number(ov.start) || (idx * 2.8));
    const oEnd = Math.min(totalEstDuration, Math.max(oStart + 0.8, Number(ov.end) || (oStart + 2.8)));
    return normalizeOverlay({
      id: `ov_${idx + 1}_${Date.now()}`,
      text: String(ov.text || '').slice(0, 70),
      start: Math.round(oStart * 10) / 10,
      end: Math.round(oEnd * 10) / 10,
      pos: ['top', 'center', 'bottom'].includes(ov.pos) ? ov.pos : (idx === 0 ? 'top' : 'center'),
      textStyle: ['pill', 'minimal', 'impact', 'yellow', 'neon'].includes(ov.textStyle) ? ov.textStyle : (idx === 0 ? 'yellow' : 'pill'),
      font: ov.font && FONTS_MAP[ov.font] ? ov.font : 'archivo',
      effect: ov.effect,
      effectIn: ov.effectIn,
      effectLoop: ov.effectLoop,
      effectOut: ov.effectOut,
      speed: ov.speed
    });
  }).filter(ov => ov && ov.text);

  return textOverlays.length ? textOverlays : [
    normalizeOverlay({ id: 'ov_1', text: 'MIRA ESTO', start: 0, end: Math.min(2.5, totalEstDuration), pos: 'top', textStyle: 'yellow', font: 'archivo', effectIn: 'pop', effectLoop: 'none', effectOut: 'fade', speed: 'normal' })
  ];
}

// ───────────────────────── Voz (Gemini TTS) ─────────────────────────
function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function listTtsModels(apiKey) {
  try {
    const r = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`, { timeout: 15000 });
    return (r.data?.models || []).map(m => String(m.name || '').replace(/^models\//, '')).filter(n => /tts/i.test(n));
  } catch (_) {
    return [];
  }
}

async function synthesizeVoice({ text, voice = 'Sulafat', style = '' }) {
  const apiKey = aiService.getApiKey();
  if (!apiKey) throw new Error('No hay clave de Gemini configurada.');
  const clean = String(text || '').trim();
  if (!clean) throw new Error('El guion de voz está vacío.');
  const voiceName = VOICES.some(v => v.id === voice) ? voice : 'Sulafat';
  const direction = style || 'Di con voz cálida, cercana y natural, en español de Chile, con ritmo ágil y sonrisa en la voz';
  const body = {
    contents: [{ parts: [{ text: `${direction}: ${clean}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
    }
  };

  const tried = new Set();
  let lastErr = null;
  let queue = [...TTS_MODELS];
  let discovered = false;
  while (queue.length) {
    const model = queue.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, body, { timeout: 60000 });
      const part = (res.data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
      if (!part) throw new Error('Gemini no devolvió audio.');
      const wav = pcmToWav(Buffer.from(part.inlineData.data, 'base64'));
      ensureDirs();
      const name = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.wav`;
      const out = path.join(REELS_DIR, name);
      fs.writeFileSync(out, wav);
      return { url: `/uploads/reels/${name}`, duration: (wav.length - 44) / (24000 * 2), voice: voiceName, model };
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`[ReelStudio] TTS ${model} falló:`, err.response?.data?.error?.message || err.message);
      if ((status === 404 || status === 400) && !discovered) {
        discovered = true;
        queue.push(...(await listTtsModels(apiKey)));
      }
    }
  }
  throw new Error('No se pudo generar la voz: ' + (lastErr?.response?.data?.error?.message || lastErr?.message || 'sin modelo TTS disponible'));
}

// ───────────────────────── Render con FFmpeg ─────────────────────────
function wrapText(text, maxChars) {
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else { cur = (cur + ' ' + w).trim(); }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function synthesizeOverlaysFromScenes(scenes) {
  let offset = 0;
  const list = [];
  for (const s of scenes) {
    const len = Number(s.length) || Number(s._len) || 2.5;
    if (s.text && s.text.trim()) {
      list.push(normalizeOverlay({
        text: s.text.trim(),
        start: Math.round(offset * 10) / 10,
        end: Math.round((offset + len) * 10) / 10,
        pos: s.pos || 'center',
        textStyle: s.textStyle || 'pill',
        font: s.font || 'archivo',
        effectIn: 'pop',
        effectLoop: 'none',
        effectOut: 'fade',
        speed: 'normal'
      }));
    }
    offset += len;
  }
  return list;
}

async function render({
  scenes = [],
  textOverlays = [],
  voiceUrl = '',
  voiceSegments = [],
  voiceVolume = 1,
  music = null,
  musicVolume = 0.3,
  keepClipAudio = false,
  globalTransition = 'zoomin'
}) {
  ensureDirs();
  if (!scenes.length) throw new Error('No hay escenas para renderizar.');
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpFiles = [];
  const inputs = [];
  const filters = [];

  try {
    let rawTotal = 0;
    scenes.forEach((s, i) => {
      const abs = localPath(s.url);
      const len = Math.min(Math.max(Number(s.length) || 2.5, 0.8), 8);
      const start = Math.max(Number(s.start) || 0, 0);
      const fitMode = s.fitMode === 'blur' ? 'blur' : 'crop';
      const zoom = Math.max(1, Math.min(Number(s.zoom) || 1, 3));
      const panX = Math.max(0, Math.min(Number(s.panX) != null ? Number(s.panX) : 0.5, 1));
      const panY = Math.max(0, Math.min(Number(s.panY) != null ? Number(s.panY) : 0.5, 1));

      rawTotal += len;

      if (isImage(abs)) {
        inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(len), '-i', abs);
      } else {
        inputs.push('-ss', String(start), '-t', String(len), '-i', abs);
      }

      const baseLabel = `v${i}`;
      if (fitMode === 'blur') {
        filters.push(`[${i}:v]split=2[in_bg_${i}][in_fg_${i}]`);
        filters.push(`[in_bg_${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=22:5,eq=brightness=-0.15,setsar=1,fps=${FPS}[bg_${i}]`);
        filters.push(`[in_fg_${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1,fps=${FPS}[fg_${i}]`);
        const ptsFilter = isImage(abs) ? '' : 'setpts=PTS-STARTPTS,';
        filters.push(`[bg_${i}][fg_${i}]overlay=(W-w)/2:(H-h)/2,${ptsFilter}setsar=1,fps=${FPS},format=yuv420p[${baseLabel}]`);
      } else {
        // Modo crop con zoom y encuadre interactivo panX / panY
        const scaledW = Math.round(W * zoom);
        const scaledH = Math.round(H * zoom);
        const ptsFilter = isImage(abs) ? '' : 'setpts=PTS-STARTPTS,';
        filters.push(`[${i}:v]scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${W}:${H}:x='(in_w-${W})*${panX}':y='(in_h-${H})*${panY}',${ptsFilter}setsar=1,fps=${FPS},format=yuv420p[${baseLabel}]`);
      }

      s._len = len;
    });

    let totalDuration = scenes[0]._len;
    let finalVideoLabel = 'v0';

    if (scenes.length === 1) {
      finalVideoLabel = 'v0';
      totalDuration = scenes[0]._len;
    } else {
      // Verificar si hay transiciones xfade activas
      const hasXfade = scenes.some((s, idx) => {
        if (idx === 0) return false;
        const tr = s.transition || globalTransition;
        return tr && tr !== 'none' && VALID_XFADE_TRANSITIONS.includes(tr);
      });

      if (!hasXfade) {
        // Concatenación plana estándar
        const sceneLabels = scenes.map((_, idx) => `[v${idx}]`).join('');
        filters.push(`${sceneLabels}concat=n=${scenes.length}:v=1:a=0[concat_out]`);
        finalVideoLabel = 'concat_out';
        totalDuration = rawTotal;
      } else {
        // Encadenamiento dinámico con xfade
        let currentLabel = 'v0';
        let currentDur = scenes[0]._len;

        for (let i = 0; i < scenes.length - 1; i++) {
          const nextIdx = i + 1;
          const nextLen = scenes[nextIdx]._len;
          let tr = scenes[nextIdx].transition || globalTransition || 'zoomin';
          const isNone = (tr === 'none');
          if (isNone) {
            tr = 'fade';
          } else if (!VALID_XFADE_TRANSITIONS.includes(tr)) {
            tr = 'zoomin';
          }

          const transDur = isNone ? 0.04 : Math.min(0.35, Math.min(currentDur * 0.35, nextLen * 0.35));
          const offset = Math.max(0, currentDur - transDur);
          const outLabel = `vx${i + 1}`;

          filters.push(`[${currentLabel}][v${nextIdx}]xfade=transition=${tr}:duration=${transDur.toFixed(2)}:offset=${offset.toFixed(2)}[${outLabel}]`);

          currentLabel = outLabel;
          currentDur = offset + nextLen;
        }

        finalVideoLabel = currentLabel;
        totalDuration = currentDur;
      }
    }

    // Normalización y validación de frases de voz
    let rawSegments = Array.isArray(voiceSegments) ? voiceSegments.slice(0, 20) : [];
    if (!rawSegments.length && voiceUrl) {
      rawSegments = [{ url: voiceUrl, start: 0 }];
    }

    const validVoiceSegments = [];
    let voiceEnd = 0;
    for (const seg of rawSegments) {
      if (!seg || typeof seg.url !== 'string') continue;
      if (!seg.url.startsWith('/uploads/reels/')) continue;
      const start = Math.max(0, Math.min(Number(seg.start) || 0, 120));
      const abs = localPath(seg.url);
      let dur = 0;
      if (fs.existsSync(abs)) {
        const size = fs.statSync(abs).size;
        dur = /\.wav$/i.test(abs) ? (size - 44) / (24000 * 2) : await probeDuration(abs);
      }
      validVoiceSegments.push({ url: seg.url, start, abs, dur });
      const segEnd = start + dur;
      if (segEnd > voiceEnd) voiceEnd = segEnd;
    }

    // Alargamiento si la voz es más larga que el video (tpad sobre el stream final)
    const extra = validVoiceSegments.length ? Math.max(0, voiceEnd + 0.5 - totalDuration) : 0;
    let masterVideo = finalVideoLabel;
    if (extra > 0) {
      filters.push(`[${masterVideo}]tpad=stop_mode=clone:stop_duration=${extra.toFixed(2)}[vout_padded]`);
      masterVideo = 'vout_padded';
      totalDuration += extra;
    }

    // Pista de Textos Desacoplada (Overlays en la línea de tiempo global)
    const rawOverlaysToRender = (Array.isArray(textOverlays) && textOverlays.length)
      ? textOverlays
      : synthesizeOverlaysFromScenes(scenes);

    let overlaysToRender = rawOverlaysToRender.map(normalizeOverlay).filter(ov => ov && ov.text && String(ov.text).trim());

    // Presupuesto de drawtexts (máximo 120 por render)
    let estimatedDrawtexts = 0;
    overlaysToRender.forEach((ov) => {
      const lines = wrapText(ov.text, 16);
      lines.forEach((ln) => {
        let countForLine = 1;
        if (ov.effectIn === 'typewriter') countForLine += Math.min(30, ln.length) - 1;
        else if (ov.effectIn === 'wordbyword') countForLine += ln.split(/\s+/).filter(Boolean).length - 1;
        else if (ov.effectIn === 'wind' || ov.effectIn === 'glitch') countForLine += 2;
        else if (ov.effectIn === 'magic') countForLine += 1;

        if (ov.effectOut === 'typewriter') countForLine += Math.min(30, ln.length);
        else if (ov.effectOut === 'wind' || ov.effectOut === 'glitch') countForLine += 2;
        else if (ov.effectOut === 'magic') countForLine += 1;

        estimatedDrawtexts += countForLine;
      });
    });

    let degradeDrawtexts = false;
    if (estimatedDrawtexts > 120) {
      console.warn(`[ReelStudio] drawtext count (${estimatedDrawtexts}) > 120; degradando typewriter a fade y omitiendo capas fantasma.`);
      degradeDrawtexts = true;
      overlaysToRender = overlaysToRender.map((ov) => ({
        ...ov,
        effectIn: ['typewriter', 'wordbyword'].includes(ov.effectIn) ? 'fade' : ov.effectIn,
        effectOut: ov.effectOut === 'typewriter' ? 'fade' : ov.effectOut
      }));
    }

    let currentMaster = masterVideo;
    let overlayCounter = 0;

    for (let oIdx = 0; oIdx < overlaysToRender.length; oIdx++) {
      const ov = overlaysToRender[oIdx];
      const textRaw = String(ov.text || '').trim();
      if (!textRaw) continue;

      const start = Math.max(0, Number(ov.start) || 0);
      const end = Math.min(totalDuration, Math.max(start + 0.4, Number(ov.end) || (start + 2.8)));
      const pos = ['top', 'center', 'bottom'].includes(ov.pos) ? ov.pos : 'center';
      const textStyle = ['pill', 'minimal', 'impact', 'yellow', 'neon'].includes(ov.textStyle) ? ov.textStyle : 'pill';
      const fontKey = ov.font && FONTS_MAP[ov.font] ? ov.font : 'archivo';
      const fontFile = FONTS_MAP[fontKey] || FONTS_MAP.archivo;
      const effectIn = ov.effectIn || 'pop';
      const effectLoop = ov.effectLoop || 'none';
      const effectOut = ov.effectOut || 'fade';
      const speed = ov.speed || 'normal';

      const { inDur, outDur } = getTiming(start, end, speed);

      const lines = wrapText(textRaw, 16);
      if (!lines.length) continue;

      let fontSize = lines.length > 2 ? 88 : 100;
      if (['archivo', 'anton', 'bangers', 'titan'].includes(fontKey)) {
        fontSize = lines.length > 2 ? 98 : 112;
      }
      if (fontKey === 'caveat') {
        fontSize = lines.length > 2 ? 104 : 120;
      }
      const lineH = Math.round(fontSize * 1.25);
      const blockH = lines.length * lineH;
      const baseY = pos === 'top' ? 240 : pos === 'bottom' ? H - 420 - blockH : Math.round((H - blockH) / 2);

      let styleAttrs = '';
      let ghostStyleAttrs = '';
      if (textStyle === 'pill') {
        styleAttrs = `:box=1:boxcolor=black@0.78:boxborderw=20:fontcolor=white:shadowcolor=black@0.4:shadowx=2:shadowy=2`;
        ghostStyleAttrs = `:fontcolor=white:shadowcolor=black@0.4:shadowx=2:shadowy=2`;
      } else if (textStyle === 'impact') {
        styleAttrs = `:borderw=7:bordercolor=black:fontcolor=white:shadowcolor=black@0.8:shadowx=4:shadowy=4`;
        ghostStyleAttrs = `:borderw=4:bordercolor=black:fontcolor=white:shadowcolor=black@0.8:shadowx=4:shadowy=4`;
      } else if (textStyle === 'yellow') {
        styleAttrs = `:box=1:boxcolor=yellow@0.95:boxborderw=18:fontcolor=black:shadowcolor=black@0.2:shadowx=2:shadowy=2`;
        ghostStyleAttrs = `:fontcolor=black:shadowcolor=black@0.2:shadowx=2:shadowy=2`;
      } else if (textStyle === 'neon') {
        styleAttrs = `:box=1:boxcolor=black@0.80:boxborderw=16:fontcolor=0x22d3ee:shadowcolor=0x22d3ee@0.8:shadowx=0:shadowy=0`;
        ghostStyleAttrs = `:fontcolor=0x22d3ee:shadowcolor=0x22d3ee@0.8:shadowx=0:shadowy=0`;
      } else if (textStyle === 'minimal') {
        styleAttrs = `:box=1:boxcolor=black@0.35:boxborderw=10:fontcolor=white:shadowcolor=black@0.6:shadowx=3:shadowy=3`;
        ghostStyleAttrs = `:fontcolor=white:shadowcolor=black@0.6:shadowx=3:shadowy=3`;
      }

      const drawFilters = [];

      const glitchTop = []; // copias roja/cian del glitch: encima del texto (si van detrás, la cápsula las tapa)
      for (let k = 0; k < lines.length; k++) {
        const ln = lines[k];
        const lineY = baseY + k * lineH;
        const lineCenterY = lineY + Math.round(lineH / 2);
        const tIn0 = start + k * 0.08;
        const tInEnd = tIn0 + inDur;
        const tOut0 = Math.max(tInEnd, end - outDur);

        const isTwIn = (effectIn === 'typewriter');
        const isWbwIn = (effectIn === 'wordbyword');
        const isTwOut = (effectOut === 'typewriter');
        const hasPrefixIn = isTwIn || isWbwIn;

        // Archivo del texto completo de la línea
        const tf = path.join(TMP_DIR, `ov_${id}_${oIdx}_${k}.txt`);
        fs.writeFileSync(tf, ln, 'utf8');
        tmpFiles.push(tf);

        // Capas fantasma de ENTRADA (wind, magic, glitch) - van ANTES del texto principal
        if (!degradeDrawtexts && !hasPrefixIn) {
          if (effectIn === 'wind') {
            const pStr = `clip((t - ${tIn0.toFixed(2)})/${inDur.toFixed(2)}, 0, 1)`;
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}${ghostStyleAttrs}:x='((w-text_w)/2) - 40 * (1 - ${pStr})':y='${lineCenterY} - text_h/2':alpha='0.35 * (1 - ${pStr})':enable='between(t,${tIn0.toFixed(2)},${tInEnd.toFixed(2)})'`);
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}${ghostStyleAttrs}:x='((w-text_w)/2) - 80 * (1 - ${pStr})':y='${lineCenterY} - text_h/2':alpha='0.15 * (1 - ${pStr})':enable='between(t,${tIn0.toFixed(2)},${tInEnd.toFixed(2)})'`);
          } else if (effectIn === 'glitch') {
            const pStr = `clip((t - ${tIn0.toFixed(2)})/${inDur.toFixed(2)}, 0, 1)`;
            glitchTop.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}:fontcolor=0xff2222:shadowx=0:shadowy=0:x='((w-text_w)/2) + 8 * (1 - ${pStr})':y='${lineCenterY} - text_h/2':alpha='0.7 * (1 - ${pStr})':enable='between(t,${tIn0.toFixed(2)},${tInEnd.toFixed(2)})'`);
            glitchTop.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}:fontcolor=0x22ffff:shadowx=0:shadowy=0:x='((w-text_w)/2) - 8 * (1 - ${pStr})':y='${lineCenterY} - text_h/2':alpha='0.7 * (1 - ${pStr})':enable='between(t,${tIn0.toFixed(2)},${tInEnd.toFixed(2)})'`);
          } else if (effectIn === 'magic') {
            const pStr = `clip((t - ${tIn0.toFixed(2)})/${inDur.toFixed(2)}, 0, 1)`;
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize='round(${fontSize} * (1.18 + 0.12 * (1 - ${pStr})))':fontcolor=white@0.85:shadowx=0:shadowy=0:x=(w-text_w)/2:y='${lineCenterY} - text_h/2':alpha='0.6 * (1 - ${pStr})':enable='between(t,${tIn0.toFixed(2)},${tInEnd.toFixed(2)})'`);
          }
        }

        // Capas fantasma de SALIDA (wind, magic, glitch) - van ANTES del texto principal
        if (!degradeDrawtexts && !isTwOut) {
          if (effectOut === 'wind') {
            const qStr = `clip((t - ${tOut0.toFixed(2)})/${outDur.toFixed(2)}, 0, 1)`;
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}${ghostStyleAttrs}:x='((w-text_w)/2) + 40 * ${qStr}':y='${lineCenterY} - text_h/2':alpha='0.35 * (1 - ${qStr})':enable='between(t,${tOut0.toFixed(2)},${end.toFixed(2)})'`);
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}${ghostStyleAttrs}:x='((w-text_w)/2) + 80 * ${qStr}':y='${lineCenterY} - text_h/2':alpha='0.15 * (1 - ${qStr})':enable='between(t,${tOut0.toFixed(2)},${end.toFixed(2)})'`);
          } else if (effectOut === 'glitch') {
            const qStr = `clip((t - ${tOut0.toFixed(2)})/${outDur.toFixed(2)}, 0, 1)`;
            glitchTop.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}:fontcolor=0xff2222:shadowx=0:shadowy=0:x='((w-text_w)/2) + 8 * ${qStr}':y='${lineCenterY} - text_h/2':alpha='0.7 * (1 - ${qStr})':enable='between(t,${tOut0.toFixed(2)},${end.toFixed(2)})'`);
            glitchTop.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fontSize}:fontcolor=0x22ffff:shadowx=0:shadowy=0:x='((w-text_w)/2) - 8 * ${qStr}':y='${lineCenterY} - text_h/2':alpha='0.7 * (1 - ${qStr})':enable='between(t,${tOut0.toFixed(2)},${end.toFixed(2)})'`);
          } else if (effectOut === 'magic') {
            const qStr = `clip((t - ${tOut0.toFixed(2)})/${outDur.toFixed(2)}, 0, 1)`;
            drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize='round(${fontSize} * (1.0 + 0.3 * ${qStr}))':fontcolor=white@0.85:shadowx=0:shadowy=0:x=(w-text_w)/2:y='${lineCenterY} - text_h/2':alpha='0.6 * (1 - ${qStr})':enable='between(t,${tOut0.toFixed(2)},${end.toFixed(2)})'`);
          }
        }

        // Construcción de la capa principal de texto
        if (hasPrefixIn || isTwOut) {
          // Medir ancho de la línea completa con sharp para alinear prefijos a la izquierda
          const fullW = await measureTextWidth(ln, fontFile, fontSize);
          const leftX = fullW ? Math.max(20, Math.round((W - fullW) / 2)) : null;

          let prefixesIn = [];
          if (isWbwIn) {
            const words = ln.split(/\s+/).filter(Boolean);
            prefixesIn = words.map((_, wIdx) => words.slice(0, wIdx + 1).join(' '));
          } else if (isTwIn) {
            const stepCount = Math.min(30, ln.length);
            for (let s = 0; s < stepCount; s++) {
              const charCount = Math.round(((s + 1) / stepCount) * ln.length);
              prefixesIn.push(ln.slice(0, charCount));
            }
          }

          // Pasos de entrada (prefijos antes del texto completo)
          let tFullStart = tIn0;
          if (prefixesIn.length > 0) {
            const stepDurIn = inDur / prefixesIn.length;
            for (let s = 0; s < prefixesIn.length - 1; s++) {
              const pTxt = prefixesIn[s];
              const pTf = path.join(TMP_DIR, `ov_${id}_${oIdx}_${k}_in_${s}.txt`);
              fs.writeFileSync(pTf, pTxt, 'utf8');
              tmpFiles.push(pTf);
              const tStep0 = tIn0 + s * stepDurIn;
              const tStep1 = tIn0 + (s + 1) * stepDurIn;
              const pX = leftX != null ? `${leftX}` : `(w-text_w)/2`;
              drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(pTf)}':fontsize=${fontSize}${styleAttrs}:x=${pX}:y='${lineCenterY} - text_h/2':alpha=1:enable='between(t,${tStep0.toFixed(2)},${tStep1.toFixed(2)})'`);
            }
            tFullStart = tIn0 + (prefixesIn.length - 1) * stepDurIn;
          }

          // Texto completo durante el loop (y salida si effectOut no es typewriter)
          const pStr = `clip((t - ${tIn0.toFixed(2)})/${inDur.toFixed(2)}, 0, 1)`;
          const qStr = `clip((t - ${tOut0.toFixed(2)})/${outDur.toFixed(2)}, 0, 1)`;
          const inExpr = getEntranceExpr(effectIn, pStr);
          const loopExpr = getLoopExpr(effectLoop, k);
          const outExpr = getExitExpr(effectOut, qStr);

          const scaleExpr = isTwOut
            ? (loopExpr.scale === '1' ? '1' : `if(lt(t, ${tInEnd.toFixed(2)}), 1, ${loopExpr.scale})`)
            : composeValue(hasPrefixIn ? '1' : inExpr.scale, loopExpr.scale, outExpr.scale, tInEnd, tOut0);
          const dxExpr = composeValue(hasPrefixIn ? '0' : inExpr.dx, loopExpr.dx, isTwOut ? '0' : outExpr.dx, tInEnd, tOut0);
          const dyExpr = composeValue(hasPrefixIn ? '0' : inExpr.dy, loopExpr.dy, isTwOut ? '0' : outExpr.dy, tInEnd, tOut0);
          const alphaExpr = isTwOut
            ? (loopExpr.alpha === '1' ? '1' : `if(lt(t, ${tInEnd.toFixed(2)}), 1, ${loopExpr.alpha})`)
            : composeValue(hasPrefixIn ? '1' : inExpr.alpha, loopExpr.alpha, outExpr.alpha, tInEnd, tOut0);

          const fsExpr = scaleExpr === '1' ? `${fontSize}` : `'round(${fontSize} * (${scaleExpr}))'`;
          let xExpr = '';
          if (leftX != null) {
            xExpr = dxExpr === '0' ? `${leftX}` : `'${leftX} + (${dxExpr})'`;
          } else {
            xExpr = dxExpr === '0' ? `(w-text_w)/2` : `'(w-text_w)/2 + (${dxExpr})'`;
          }
          const yExpr = dyExpr === '0' ? `'${lineCenterY} - text_h/2'` : `'${lineCenterY} - text_h/2 + (${dyExpr})'`;
          const aExpr = alphaExpr === '1' ? `1` : `'${alphaExpr}'`;

          const tFullEnd = isTwOut ? tOut0 : end;
          drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fsExpr}${styleAttrs}:x=${xExpr}:y=${yExpr}:alpha=${aExpr}:enable='between(t,${tFullStart.toFixed(2)},${tFullEnd.toFixed(2)})'`);

          // Pasos de salida (typewriter en orden inverso)
          if (isTwOut) {
            const stepCountOut = Math.min(30, ln.length);
            const stepDurOut = outDur / stepCountOut;
            for (let e = 0; e < stepCountOut; e++) {
              const charCount = Math.round(((stepCountOut - 1 - e) / stepCountOut) * ln.length);
              if (charCount <= 0) continue;
              const pTxt = ln.slice(0, charCount);
              const pTf = path.join(TMP_DIR, `ov_${id}_${oIdx}_${k}_out_${e}.txt`);
              fs.writeFileSync(pTf, pTxt, 'utf8');
              tmpFiles.push(pTf);
              const tStep0 = tOut0 + e * stepDurOut;
              const tStep1 = tOut0 + (e + 1) * stepDurOut;
              const pX = leftX != null ? `${leftX}` : `(w-text_w)/2`;
              drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(pTf)}':fontsize=${fontSize}${styleAttrs}:x=${pX}:y='${lineCenterY} - text_h/2':alpha=1:enable='between(t,${tStep0.toFixed(2)},${tStep1.toFixed(2)})'`);
            }
          }
        } else {
          // Caso estándar (sin typewriter ni wordbyword)
          const pStr = `clip((t - ${tIn0.toFixed(2)})/${inDur.toFixed(2)}, 0, 1)`;
          const qStr = `clip((t - ${tOut0.toFixed(2)})/${outDur.toFixed(2)}, 0, 1)`;
          const inExpr = getEntranceExpr(effectIn, pStr);
          const loopExpr = getLoopExpr(effectLoop, k);
          const outExpr = getExitExpr(effectOut, qStr);

          const scaleExpr = composeValue(inExpr.scale, loopExpr.scale, outExpr.scale, tInEnd, tOut0);
          const dxExpr = composeValue(inExpr.dx, loopExpr.dx, outExpr.dx, tInEnd, tOut0);
          const dyExpr = composeValue(inExpr.dy, loopExpr.dy, outExpr.dy, tInEnd, tOut0);
          const alphaExpr = composeValue(inExpr.alpha, loopExpr.alpha, outExpr.alpha, tInEnd, tOut0);

          const fsExpr = scaleExpr === '1' ? `${fontSize}` : `'round(${fontSize} * (${scaleExpr}))'`;
          const xExpr = dxExpr === '0' ? `(w-text_w)/2` : `'(w-text_w)/2 + (${dxExpr})'`;
          const yExpr = dyExpr === '0' ? `'${lineCenterY} - text_h/2'` : `'${lineCenterY} - text_h/2 + (${dyExpr})'`;
          const aExpr = alphaExpr === '1' ? `1` : `'${alphaExpr}'`;

          drawFilters.push(`drawtext=fontfile='${fontFile}':textfile='${rel(tf)}':fontsize=${fsExpr}${styleAttrs}:x=${xExpr}:y=${yExpr}:alpha=${aExpr}:enable='between(t,${tIn0.toFixed(2)},${end.toFixed(2)})'`);
        }
      }
      drawFilters.push(...glitchTop);

      if (drawFilters.length > 0) {
        const nextMaster = `vt_${overlayCounter++}`;
        filters.push(`[${currentMaster}]${drawFilters.join(',')}[${nextMaster}]`);
        currentMaster = nextMaster;
      }
    }

    finalVideoLabel = currentMaster;

    // Audio mixing con frases de voz (adelay + amix) y música de fondo con ducking
    let nextIdx = scenes.length;
    const voiceSegIndices = [];
    for (const seg of validVoiceSegments) {
      inputs.push('-i', seg.abs);
      voiceSegIndices.push(nextIdx++);
    }

    let musicIdx = -1;
    if (music?.url) {
      const cached = await musicService.ensureTrackCached(music.url, { title: music.title || '', artist: music.artist || '' });
      inputs.push('-ss', String(Math.max(Number(music.start) || 0, 0)), '-i', cached);
      musicIdx = nextIdx++;
    }

    const hasVoice = validVoiceSegments.length > 0;
    if (hasVoice) {
      if (validVoiceSegments.length > 1) {
        validVoiceSegments.forEach((seg, k) => {
          const delayMs = Math.round(seg.start * 1000);
          filters.push(`[${voiceSegIndices[k]}:a]adelay=${delayMs}|${delayMs},apad[s_${k}]`);
        });
        const mixInputs = validVoiceSegments.map((_, k) => `[s_${k}]`).join('');
        filters.push(`${mixInputs}amix=inputs=${validVoiceSegments.length}:normalize=0:duration=longest[vmix]`);
      } else {
        const delayMs = Math.round(validVoiceSegments[0].start * 1000);
        filters.push(`[${voiceSegIndices[0]}:a]adelay=${delayMs}|${delayMs},apad[vmix]`);
      }
    }

    const fadeOutAt = Math.max(totalDuration - 1.2, 0).toFixed(2);
    let audioMap = null;
    if (hasVoice && musicIdx >= 0) {
      filters.push(`[vmix]volume=${Number(voiceVolume) || 1},apad,asplit=2[vo][vsc]`);
      filters.push(`[${musicIdx}:a]volume=${Number(musicVolume) || 0.3},aloop=loop=-1:size=2e9[mus]`);
      filters.push(`[mus][vsc]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=400[duck]`);
      filters.push(`[vo][duck]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${totalDuration.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    } else if (hasVoice) {
      filters.push(`[vmix]volume=${Number(voiceVolume) || 1},apad,atrim=0:${totalDuration.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    } else if (musicIdx >= 0) {
      filters.push(`[${musicIdx}:a]volume=${Math.min((Number(musicVolume) || 0.3) * 2.5, 1)},aloop=loop=-1:size=2e9,atrim=0:${totalDuration.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    }

    const scriptPath = path.join(TMP_DIR, `fg_${id}.txt`);
    fs.writeFileSync(scriptPath, filters.join(';\n'), 'utf8');
    tmpFiles.push(scriptPath);

    const outName = `reel_${id}.mp4`;
    const outPath = path.join(REELS_DIR, outName);
    const args = ['-y', '-threads', '2', ...inputs, '-filter_complex_script', rel(scriptPath), '-map', `[${finalVideoLabel}]`];
    if (audioMap) args.push('-map', audioMap, '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2');
    else args.push('-an');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-t', totalDuration.toFixed(2), '-movflags', '+faststart', outPath);

    await runFFmpeg(args);
    const stat = fs.statSync(outPath);
    return {
      url: `/uploads/reels/${outName}`,
      duration: Math.round(totalDuration * 10) / 10,
      sizeBytes: stat.size,
      width: W,
      height: H
    };
  } finally {
    for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch (_) {} }
  }
}

module.exports = {
  TEMPLATES,
  VOICES,
  FONTS_MAP,
  getFonts,
  TEXT_EFFECTS_IN,
  TEXT_EFFECTS_LOOP,
  TEXT_EFFECTS_OUT,
  SPEED_OPTIONS,
  normalizeOverlay,
  getTiming,
  VALID_XFADE_TRANSITIONS,
  plan,
  suggestTextOverlays,
  synthesizeVoice,
  render,
  probeDuration,
  brandRulesFor,
  analyzeClip,
  reviewClips
};
