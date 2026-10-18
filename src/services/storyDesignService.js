// Genera la imagen (o video, si hay GIF animados) final de una historia a partir del diseño del Creador.
const path = require('path');
const fs = require('fs');
const imageService = require('./imageService');
const videoService = require('./videoService');
const stickers = require('./storyStickers');

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
 * @returns {{relativeUrl: string, type: 'image'|'video', path: string}}
 */
async function renderDesign({ imagePath, caption = '', items = [], referenceDate = new Date(), brandName = '' }) {
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

  const inputs = ['-y', '-loop', '1', '-t', String(VIDEO_SECONDS), '-i', card.outputPath];
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

  const outName = `story_design_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp4`;
  const outPath = path.join(videoService.storiesDir, outName);
  await videoService.runFFmpeg([
    ...inputs, '-filter_complex', chains.join(';'), '-map', '[v]', '-t', String(VIDEO_SECONDS), '-r', '25',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath
  ]);
  return { relativeUrl: `/uploads/stories/${outName}`, type: 'video', path: outPath };
}

module.exports = { renderDesign };
