// Genera la imagen (o video, si hay GIF animados) final de una historia a partir del diseño del Creador.
const path = require('path');
const fs = require('fs');
const imageService = require('./imageService');
const videoService = require('./videoService');
const stickers = require('./storyStickers');
const musicService = require('./musicService');

const VIDEO_SECONDS = 7;

function toAbsolute(p) {
  if (/^https?:\/\//.test(p) || (path.isAbsolute(p) && fs.existsSync(p))) return p;
  return path.join(__dirname, '../../', String(p).replace(/^\//, ''));
}

/**
 * @param {Object} o
 * @param {string} o.imagePath  imagen del post (ruta relativa /uploads/... o URL)
 * @param {string} o.caption    texto gancho ('' = sin cuadro blanco)
 * @param {Array}  o.items      elementos del diseño (ver storyStickers.js)
 * @param {Date}   [o.referenceDate] fecha de publicación (para la cuenta regresiva)
 * @param {Object} [o.music]    { audio_url, start_time, duration }: si hay GIF animados, el video lleva esta música
 *                              (para imagen fija con música, el llamador genera el video aparte con generateStoryVideo)
 * @returns {{relativeUrl: string, type: 'image'|'video', path: string}}
 */
async function renderDesign({ imagePath, caption = '', items = [], referenceDate = new Date(), brandName = '', music = null }) {
  const hasAnimated = (items || []).some(i => i && i.kind === 'emoji' && i.animated);
  const { layers, animatedItems } = await stickers.buildDesignLayers(items, { referenceDate, animated: hasAnimated });
  const card = await imageService.createStoryCard({
    inputImagePath: toAbsolute(imagePath),
    brandName,
    caption,
    extraLayers: layers
  });
  if (animatedItems.length === 0) {
    return { relativeUrl: card.relativeUrl, type: 'image', path: card.outputPath };
  }

  // Con música el video dura lo que se eligió para la canción; sin música, 7 s
  let seconds = VIDEO_SECONDS;
  let audioPath = null;
  if (music && music.audio_url) {
    seconds = Math.min(Math.max(Number(music.duration) || 15, 3), 60);
    try { audioPath = await musicService.ensureTrackCached(music.audio_url, { title: music.song_title || '' }); } catch (_) { audioPath = null; }
    if (!audioPath || !fs.existsSync(audioPath)) { audioPath = null; seconds = VIDEO_SECONDS; }
  }
  const inputs = ['-y', '-loop', '1', '-t', String(seconds), '-i', card.outputPath];
  const chains = [];
  let last = '0:v';
  animatedItems.forEach((a, i) => {
    const info = stickers.gifInfo(a.item.code);
    inputs.push('-ignore_loop', '0', '-i', info.file);
    const w = Math.max(16, Math.round(info.size * a.scale));
    const rad = `${(a.rotate * Math.PI / 180).toFixed(5)}`;
    chains.push(`[${i + 1}:v]scale=${w}:-1,format=rgba,rotate=${rad}:c=none:ow=rotw(${rad}):oh=roth(${rad})[g${i}]`);
    chains.push(`[${last}][g${i}]overlay=x=${a.cx}-w/2:y=${a.cy}-h/2:shortest=0[o${i}]`);
    last = `o${i}`;
  });
  chains.push(`[${last}]format=yuv420p[v]`);
  const audioIndex = animatedItems.length + 1;
  if (audioPath) {
    inputs.push('-ss', String(Math.max(Number(music.start_time) || 0, 0)), '-t', String(seconds), '-i', audioPath);
  }

  const outName = `story_design_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
  const outPath = path.join(videoService.storiesDir, outName);
  await videoService.runFFmpeg([
    ...inputs, '-filter_complex', chains.join(';'), '-map', '[v]',
    ...(audioPath ? ['-map', `${audioIndex}:a`, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-af', `afade=t=out:st=${Math.max(seconds - 1, 0)}:d=1`] : []),
    '-t', String(seconds), '-r', '25',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath
  ]);
  return { relativeUrl: `/uploads/stories/${outName}`, type: 'video', path: outPath, hasAudio: Boolean(audioPath) };
}

module.exports = { renderDesign };
