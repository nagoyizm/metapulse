// Diseño de historias: stickers "no oficiales" dibujados dentro de la imagen/video (no son interactivos).
// Cada elemento del diseño: { id, kind: 'location'|'mention'|'countdown'|'emoji', text, code, x, y, scale, rotate, animated }
// x,y = centro del elemento como fracción (0..1) del lienzo 1080x1920.
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');

const STORY_W = 1080;
const STORY_H = 1920;
const FONT = path.resolve(__dirname, '../../assets/fonts/Montserrat-Medium.ttf');
const FONT_BOLD = path.resolve(__dirname, '../../assets/fonts/Lato-Bold.ttf');
const EMOJI_DIR = path.resolve(__dirname, '../../assets/stickers/noto');
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const EMOJI_BASE = 200;

const EMOJI_LABELS = {
  '1f389': 'Fiesta', '1f38a': 'Confeti', '1f942': 'Brindis', '1f377': 'Vino', '2615': 'Café', '1f30a': 'Ola',
  '1f31e': 'Sol', '1f60e': 'Genial', '1f60d': 'Encanto', '1f973': 'Celebrar', '1f64c': 'Yay', '1f44f': 'Aplauso',
  '1f44d': 'Like', '1f525': 'Fuego', '2764': 'Corazón', '1f9e1': 'Cariño', '2b50': 'Estrella', '2728': 'Brillo',
  '1f4a5': 'Boom', '1f4af': '100', '1f381': 'Regalo', '23f3': 'Reloj'
};

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function emojiPath(code, ext) {
  const safe = String(code || '').replace(/[^0-9a-f]/gi, '');
  return path.join(EMOJI_DIR, `${safe}.${ext}`);
}

function getCatalog() {
  if (!fs.existsSync(EMOJI_DIR)) return [];
  return fs.readdirSync(EMOJI_DIR)
    .filter(f => f.endsWith('.png') && f !== '1f4cd.png')
    .map(f => f.replace('.png', ''))
    .map(code => ({ code, label: EMOJI_LABELS[code] || code, animated: fs.existsSync(emojiPath(code, 'gif')) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

async function textBuf(text, { size = 28, color = '#262626', fontfile = FONT, font = 'Montserrat Medium' } = {}) {
  return sharp({
    text: { text: `<span foreground="${color}" size="${size * 1000}">${esc(text)}</span>`, font, fontfile, rgba: true }
  }).png().toBuffer();
}

async function emojiBuf(code, size) {
  const file = emojiPath(code, 'png');
  if (!fs.existsSync(file)) return null;
  return sharp(file).resize(size, size, { fit: 'contain', background: CLEAR }).png().toBuffer();
}

// Píldora blanca (ubicación / mención) con icono opcional.
async function pill(text, { icon = null } = {}) {
  const t = await textBuf(text, { size: 30 });
  const tm = await sharp(t).metadata();
  const h = 74;
  const iconSize = 44;
  const ic = icon ? await emojiBuf(icon, iconSize) : null;
  const padX = 30;
  const w = padX * 2 + tm.width + (ic ? iconSize + 12 : 0);
  const bg = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${h / 2}" fill="#fff"/></svg>`);
  const layers = [];
  let x = padX;
  if (ic) { layers.push({ input: ic, left: x, top: Math.round((h - iconSize) / 2) }); x += iconSize + 12; }
  layers.push({ input: t, left: x, top: Math.round((h - tm.height) / 2) });
  return sharp(bg).composite(layers).png().toBuffer();
}

// Tarjeta de cuenta regresiva: FALTAN · 74 · DÍAS
async function countdown(days) {
  const label = await textBuf('FALTAN', { size: 22, color: '#8e8e8e' });
  const num = await textBuf(String(days), { size: 64, fontfile: FONT_BOLD, font: 'Lato' });
  const unit = await textBuf(days === 1 ? 'DÍA' : 'DÍAS', { size: 22, color: '#8e8e8e' });
  const [lm, nm, um] = await Promise.all([label, num, unit].map(b => sharp(b).metadata()));
  const gap = 26, padX = 40, h = 130;
  const w = padX * 2 + lm.width + nm.width + um.width + gap * 2;
  const bg = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="32" fill="#fff"/></svg>`);
  const mid = (m) => Math.round((h - m.height) / 2);
  return sharp(bg).composite([
    { input: label, left: padX, top: mid(lm) },
    { input: num, left: padX + lm.width + gap, top: mid(nm) },
    { input: unit, left: padX + lm.width + gap + nm.width + gap, top: mid(um) }
  ]).png().toBuffer();
}

// Sombra suave bajo un sticker (deja 24 px de margen alrededor).
async function withShadow(buf) {
  const m = await sharp(buf).metadata();
  const pad = 24;
  const a = await sharp(buf).extend({ top: pad, bottom: pad, left: pad, right: pad, background: CLEAR })
    .extractChannel(3).blur(10).linear(0.35, 0).toBuffer();
  const sh = await sharp({ create: { width: m.width + pad * 2, height: m.height + pad * 2, channels: 3, background: '#000' } })
    .joinChannel(a).png().toBuffer();
  return sharp(sh).composite([{ input: buf, left: pad, top: pad - 6 }]).png().toBuffer();
}

// Capas del sticker de emoji: borde blanco + sombra (sin el emoji) y el emoji. Mismo lienzo para ambas.
async function emojiLayers(code, size) {
  const base = await emojiBuf(code, size);
  if (!base) return null;
  const pad = 30;
  const canvas = size + pad * 2;
  const full = canvas + 20;
  const padded = await sharp(base).extend({ top: pad, bottom: pad, left: pad, right: pad, background: CLEAR }).png().toBuffer();
  const alpha = await sharp(padded).extractChannel(3).blur(10).threshold(8).toBuffer();
  const white = await sharp({ create: { width: canvas, height: canvas, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha).png().toBuffer();
  const shadowA = await sharp(alpha).blur(8).linear(0.5, 0).toBuffer();
  const shadow = await sharp({ create: { width: canvas, height: canvas, channels: 3, background: '#000000' } })
    .joinChannel(shadowA).png().toBuffer();
  const outline = await sharp({ create: { width: full, height: full, channels: 4, background: CLEAR } })
    .composite([{ input: shadow, left: 10, top: 18 }, { input: white, left: 10, top: 10 }]).png().toBuffer();
  const emoji = await sharp({ create: { width: full, height: full, channels: 4, background: CLEAR } })
    .composite([{ input: padded, left: 10, top: 10 }]).png().toBuffer();
  return { outline, emoji, size: full };
}

/**
 * PNG de un elemento a escala 1 y sin rotar. Devuelve { buffer, width, height } o null.
 * Para emoji: buffer = borde + emoji estático.
 */
async function renderElement(item, { countdownDays = 0 } = {}) {
  let buffer = null;
  if (item.kind === 'location') {
    if (!String(item.text || '').trim()) return null;
    buffer = await withShadow(await pill(String(item.text).trim(), { icon: '1f4cd' }));
  } else if (item.kind === 'mention') {
    if (!String(item.text || '').trim()) return null;
    buffer = await withShadow(await pill(String(item.text).trim()));
  } else if (item.kind === 'countdown') {
    buffer = await withShadow(await countdown(Math.max(0, Math.round(countdownDays))));
  } else if (item.kind === 'emoji') {
    const l = await emojiLayers(item.code, EMOJI_BASE);
    if (!l) return null;
    buffer = await sharp(l.outline).composite([{ input: l.emoji }]).png().toBuffer();
  }
  if (!buffer) return null;
  const m = await sharp(buffer).metadata();
  return { buffer, width: m.width, height: m.height };
}

const clampScale = (s) => Math.min(4, Math.max(0.3, Number(s) || 1));
const clamp01 = (v) => Math.min(1.2, Math.max(-0.2, Number(v)));

// Escala y rota un PNG; devuelve el buffer y su tamaño final.
async function transformPng(buf, scale, rotate) {
  const m = await sharp(buf).metadata();
  let img = sharp(buf);
  const w = Math.max(8, Math.round(m.width * scale));
  const h = Math.max(8, Math.round(m.height * scale));
  let out = await img.resize(w, h).png().toBuffer();
  if (rotate) out = await sharp(out).rotate(rotate, { background: CLEAR }).png().toBuffer();
  const fm = await sharp(out).metadata();
  return { buffer: out, width: fm.width, height: fm.height };
}

/** Días entre una fecha de referencia y la fecha objetivo (YYYY-MM-DD), mínimo 0. */
function daysUntil(targetDate, fromDate = new Date()) {
  const t = new Date(`${targetDate}T12:00:00`);
  if (isNaN(t.getTime())) return 0;
  const f = new Date(fromDate);
  f.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((t.getTime() - f.getTime()) / 86400000));
}

/**
 * Capas estáticas (para sharp.composite) de los elementos del diseño. Con animated=true se omiten los
 * emojis animados (van como GIF en el video). Devuelve { layers, animatedItems }.
 */
async function buildDesignLayers(items, { referenceDate = new Date(), animated = false } = {}) {
  const layers = [];
  const animatedItems = [];
  for (const item of items || []) {
    if (!item || !item.kind) continue;
    const cd = item.kind === 'countdown' ? daysUntil(item.targetDate, referenceDate) : 0;
    const el = await renderElement(item, { countdownDays: cd });
    if (!el) continue;
    const scale = clampScale(item.scale);
    const rotate = Number(item.rotate) || 0;
    const cx = Math.round(clamp01(item.x) * STORY_W);
    const cy = Math.round(clamp01(item.y) * STORY_H);
    if (animated && item.kind === 'emoji' && item.animated && fs.existsSync(emojiPath(item.code, 'gif'))) {
      animatedItems.push({ item, cx, cy, scale, rotate });
      continue;
    }
    const t = await transformPng(el.buffer, scale, rotate);
    layers.push({ input: t.buffer, left: cx - Math.round(t.width / 2), top: cy - Math.round(t.height / 2), blend: 'over' });
  }
  return { layers, animatedItems };
}

/** Ruta del GIF animado y tamaño base (px) para el video. */
function gifInfo(code) {
  return { file: emojiPath(code, 'gif'), size: EMOJI_BASE };
}

function tmpFile(ext) {
  return path.join(os.tmpdir(), `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

module.exports = {
  STORY_W, STORY_H, EMOJI_BASE, getCatalog, renderElement, buildDesignLayers, daysUntil, gifInfo, tmpFile, transformPng
};
