// Estudio de Reels: arma reels cortos 9:16 a partir de clips/imagenes descritos por el dueno.
// - plan(): la IA ordena y recorta los clips, escribe textos en pantalla, guion de voz y caption.
// - synthesizeVoice(): voz con Gemini TTS (WAV).
// - render(): FFmpeg une escenas + textos + voz + musica en un MP4 1080x1920.
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { getSetting } = require('../database/db');
const aiService = require('./aiService');
const musicService = require('./musicService');

const ROOT = path.join(__dirname, '../..');
const REELS_DIR = path.join(ROOT, 'uploads/reels');
const TMP_DIR = path.join(REELS_DIR, 'tmp');
const FONT_BOLD = 'assets/fonts/Lato-Bold.ttf'; // relativa a ROOT (sin ":" para el filtro drawtext)
const W = 1080;
const H = 1920;
const FPS = 30;

// Voces de Gemini TTS elegibles (nombre oficial -> como suena)
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

// Duracion en segundos leyendo la salida de "ffmpeg -i" (no hay ffprobe)
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

// ───────────────────────── Plan con IA ─────────────────────────
async function plan({ brand = '', clips = [], goal = '', targetSeconds = 10 }) {
  if (!clips.length) throw new Error('Agrega al menos un clip o imagen.');
  const target = Math.min(Math.max(Number(targetSeconds) || 10, 6), 20);

  const described = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const abs = localPath(c.url);
    const dur = await probeDuration(abs);
    described.push({ index: i, url: c.url, kind: isImage(abs) ? 'imagen' : 'video', duration: dur ? Math.round(dur * 10) / 10 : null, description: String(c.description || '').slice(0, 300) });
  }

  const lower = String(brand).toLowerCase();
  const isKmarket = lower.includes('kmarket');
  const isCampina = lower.includes('campi');
  const brandRules = isKmarket
    ? 'Marca: Kmarket Algarrobo, tienda de snacks, helados, ramen y bebidas coreanas empaquetadas (NO es carnicería ni restaurante). Tono cercano, apetitoso y sobrio. El caption DEBE terminar con la dirección: "📍 Encuéntralo en Kmarket Algarrobo\\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo" y 3-5 hashtags incluyendo #KmarketAlgarrobo #KFood.'
    : isCampina
      ? 'Marca: Cabañas La Campiña (Algarrobo): cabañas rústicas familiares, quinchos con parrilla, pinos y jardines. CERO tinajas, jacuzzis ni hot tubs. Tono cálido y familiar. El caption invita a escribir por WhatsApp para reservar y lleva 3-5 hashtags.'
      : `Marca: ${brand || 'la marca'}. Tono cercano y claro.`;

  const prompt = `Eres editor de reels de Instagram/Facebook de alto rendimiento. Arma un reel vertical de ${target} segundos (máximo ${target + 3}) con estos clips del dueño.

${brandRules}

OBJETIVO DEL REEL: ${goal || 'mostrar el producto/lugar y provocar que lo envíen a alguien'}

CLIPS DISPONIBLES (índice, tipo, duración, descripción del dueño):
${JSON.stringify(described, null, 1)}

REGLAS:
1. Escena 1 = GANCHO que atrapa en el primer segundo. Última escena = cierre que invita a ENVIARLO a alguien (no "comprar ahora", no menciones tiendas ajenas).
2. Cada escena usa un clip (puedes reutilizar un clip con otro tramo). "start" y "length" en segundos; start+length no puede superar la duración del clip (las imágenes aceptan cualquier length). Escenas de 1.5 a 4 s, cortes rápidos.
3. "text": texto en pantalla de 2 a 6 palabras por escena, en español, impactante, sin emojis. "pos": "top", "center" o "bottom".
4. "voiceover": guion hablado, cálido y natural, en español chileno neutro, máximo ${Math.round(target * wordsPerSecond())} palabras en total (debe caber en el reel). Sin emojis ni hashtags.
5. "caption": texto del post (máx 600 caracteres), con gancho en la primera línea.
6. "musicQuery": 2-4 palabras en español o inglés para buscar música de fondo adecuada.
7. No inventes productos, precios ni instalaciones que el dueño no haya descrito.

Devuelve SOLO JSON:
{"title":"nombre interno corto","scenes":[{"clip":0,"start":0,"length":2.5,"text":"...","pos":"center"}],"voiceover":"...","caption":"...","musicQuery":"..."}`;

  const { data } = await aiService.generateJSON({ prompt, temperature: 0.7, maxOutputTokens: 4096 });
  const scenes = (Array.isArray(data.scenes) ? data.scenes : []).map((s) => {
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
    return {
      clip: clipIdx,
      url: info.url,
      kind: info.kind,
      start: Math.round(start * 10) / 10,
      length: Math.round(length * 10) / 10,
      text: String(s.text || '').slice(0, 60),
      pos: ['top', 'center', 'bottom'].includes(s.pos) ? s.pos : 'center'
    };
  }).filter(s => s.url);
  if (!scenes.length) throw new Error('La IA no devolvió escenas utilizables. Intenta de nuevo con descripciones más claras.');

  let caption = String(data.caption || '');
  try { caption = aiService.cleanCaptionAI(caption); } catch (_) {}
  return {
    title: String(data.title || 'Reel').slice(0, 80),
    scenes,
    voiceover: String(data.voiceover || '').trim(),
    caption,
    musicQuery: String(data.musicQuery || '').trim()
  };
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

// ───────────────────────── Render ─────────────────────────
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

async function render({ scenes = [], voiceUrl = '', voiceVolume = 1, music = null, musicVolume = 0.3, keepClipAudio = false }) {
  ensureDirs();
  if (!scenes.length) throw new Error('No hay escenas para renderizar.');
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpFiles = [];
  const inputs = [];
  const filters = [];
  const sceneLabels = [];

  try {
    let total = 0;
    scenes.forEach((s, i) => {
      const abs = localPath(s.url);
      const len = Math.min(Math.max(Number(s.length) || 2.5, 0.8), 8);
      const start = Math.max(Number(s.start) || 0, 0);
      total += len;
      if (isImage(abs)) {
        inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(len), '-i', abs);
      } else {
        inputs.push('-ss', String(start), '-t', String(len), '-i', abs);
      }
      let chain;
      if (isImage(abs)) {
        // Ken Burns suave: imagen ampliada 15 % con paneo vertical lento
        chain = `[${i}:v]scale=${Math.round(W * 1.15)}:${Math.round(H * 1.15)}:force_original_aspect_ratio=increase,crop=${W}:${H}:x='(iw-ow)/2':y='(ih-oh)*t/${len}',setsar=1,fps=${FPS},format=yuv420p`;
      } else {
        chain = `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},setpts=PTS-STARTPTS,format=yuv420p`;
      }
      // Texto en pantalla: una linea por drawtext, centrada, con entrada deslizante y sombra suave (sin contornos)
      const lines = wrapText(s.text, 16);
      const fontSize = lines.length > 2 ? 92 : 108;
      const lineH = Math.round(fontSize * 1.25);
      const blockH = lines.length * lineH;
      const baseY = s.pos === 'top' ? 240 : s.pos === 'bottom' ? H - 420 - blockH : Math.round((H - blockH) / 2);
      lines.forEach((ln, k) => {
        const tf = path.join(TMP_DIR, `t_${id}_${i}_${k}.txt`);
        fs.writeFileSync(tf, ln, 'utf8');
        tmpFiles.push(tf);
        const y = baseY + k * lineH;
        const delay = (0.1 + k * 0.08).toFixed(2);
        chain += `,drawtext=fontfile='${FONT_BOLD}':textfile='${rel(tf)}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y='${y}+40*(1-min(1,max(0,(t-${delay})/0.3)))':alpha='min(1,max(0,(t-${delay})/0.25))':shadowcolor=black@0.55:shadowx=4:shadowy=4`;
      });
      const isLast = i === scenes.length - 1;
      sceneLabels.push(`[v${i}]`);
      filters.push(`${chain}[v${i}]`);
      s._len = len;
      s._isLast = isLast;
    });

    // Voz mas larga que el video: se alarga la ultima escena congelando el ultimo cuadro
    let voiceAbs = null;
    let voiceDur = 0;
    if (voiceUrl) {
      voiceAbs = localPath(voiceUrl);
      const size = fs.statSync(voiceAbs).size;
      voiceDur = /\.wav$/i.test(voiceAbs) ? (size - 44) / (24000 * 2) : await probeDuration(voiceAbs);
    }
    const extra = voiceAbs ? Math.max(0, voiceDur + 0.5 - total) : 0;
    if (extra > 0) {
      const last = scenes.length - 1;
      filters[last] = filters[last].replace(`[v${last}]`, '') + `,tpad=stop_mode=clone:stop_duration=${extra.toFixed(2)}[v${last}]`;
      total += extra;
    }

    filters.push(`${sceneLabels.join('')}concat=n=${scenes.length}:v=1:a=0[vout]`);

    // Audio
    let nextIdx = scenes.length;
    const audioLabels = [];
    let voiceIdx = -1;
    let musicIdx = -1;
    if (voiceAbs) { inputs.push('-i', voiceAbs); voiceIdx = nextIdx++; }
    if (music?.url) {
      const cached = await musicService.ensureTrackCached(music.url, { title: music.title || '', artist: music.artist || '' });
      inputs.push('-ss', String(Math.max(Number(music.start) || 0, 0)), '-i', cached);
      musicIdx = nextIdx++;
    }
    const fadeOutAt = Math.max(total - 1.2, 0).toFixed(2);
    let audioMap = null;
    if (voiceIdx >= 0 && musicIdx >= 0) {
      filters.push(`[${voiceIdx}:a]volume=${Number(voiceVolume) || 1},apad,asplit=2[vo][vsc]`);
      filters.push(`[${musicIdx}:a]volume=${Number(musicVolume) || 0.3},aloop=loop=-1:size=2e9[mus]`);
      filters.push(`[mus][vsc]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=400[duck]`);
      filters.push(`[vo][duck]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:${total.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    } else if (voiceIdx >= 0) {
      filters.push(`[${voiceIdx}:a]volume=${Number(voiceVolume) || 1},apad,atrim=0:${total.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    } else if (musicIdx >= 0) {
      filters.push(`[${musicIdx}:a]volume=${Math.min((Number(musicVolume) || 0.3) * 2.5, 1)},aloop=loop=-1:size=2e9,atrim=0:${total.toFixed(2)},afade=t=out:st=${fadeOutAt}:d=1.2[aout]`);
      audioMap = '[aout]';
    }

    const scriptPath = path.join(TMP_DIR, `fg_${id}.txt`);
    fs.writeFileSync(scriptPath, filters.join(';\n'), 'utf8');
    tmpFiles.push(scriptPath);

    const outName = `reel_${id}.mp4`;
    const outPath = path.join(REELS_DIR, outName);
    const args = ['-y', '-threads', '2', ...inputs, '-filter_complex_script', rel(scriptPath), '-map', '[vout]'];
    if (audioMap) args.push('-map', audioMap, '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2');
    else args.push('-an');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-t', total.toFixed(2), '-movflags', '+faststart', outPath);

    await runFFmpeg(args);
    const stat = fs.statSync(outPath);
    return { url: `/uploads/reels/${outName}`, duration: Math.round(total * 10) / 10, sizeBytes: stat.size, width: W, height: H };
  } finally {
    for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch (_) {} }
  }
}

module.exports = { VOICES, plan, synthesizeVoice, render, probeDuration };
