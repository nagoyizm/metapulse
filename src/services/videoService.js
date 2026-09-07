const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const sharp = require('sharp');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');
const musicService = require('./musicService');

class VideoService {
  constructor() {
    this.storiesDir = path.join(__dirname, '../../uploads/stories');
    this.tempDir = path.join(__dirname, '../../uploads/temp');

    if (!fs.existsSync(this.storiesDir)) {
      fs.mkdirSync(this.storiesDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Obtiene la ruta ejecutable de FFmpeg asegurando permisos en Linux y Windows
   */
  getFFmpegBinary() {
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      try {
        fs.chmodSync(ffmpegPath, 0o755);
      } catch (_) {}
      return ffmpegPath;
    }
    return 'ffmpeg';
  }

  /**
   * Resuelve cualquier ruta o URL de imagen a un archivo local absoluto
   */
  async resolveImageToLocal(imageInput) {
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const tempImg = path.join(this.tempDir, `download_${Date.now()}_img.jpg`);
      const resp = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 25000 });
      fs.writeFileSync(tempImg, Buffer.from(resp.data));
      return { path: tempImg, isTemp: true };
    }

    const cleanPath = imageInput.replace(/^\/+/, '');
    let absPath = path.isAbsolute(imageInput) ? imageInput : path.join(__dirname, '../../', cleanPath);

    if (!fs.existsSync(absPath)) {
      // Intentar en uploads
      const inUploads = path.join(__dirname, '../../uploads', path.basename(cleanPath));
      if (fs.existsSync(inUploads)) return { path: inUploads, isTemp: false };
      throw new Error(`No se encontró el archivo de imagen: ${imageInput}`);
    }

    return { path: absPath, isTemp: false };
  }

  /**
   * Convierte cualquier imagen a dimensiones exactas 9:16 (1080x1920) estilo Historia de Instagram
   * con fondo difuminado y añade opcionalmente el sticker flotante de música
   */
  async prepareStoryCanvas({ imagePath, addMusicSticker = false, songTitle = '', songArtist = '' }) {
    const storyWidth = 1080;
    const storyHeight = 1920;

    const inputBuffer = fs.readFileSync(imagePath);
    const meta = await sharp(inputBuffer).metadata();

    let baseCanvasBuffer;

    // Si ya tiene exactamente 1080x1920, la usamos directamente
    if (meta.width === storyWidth && meta.height === storyHeight) {
      baseCanvasBuffer = inputBuffer;
    } else {
      // 1. Crear fondo difuminado 1080x1920
      const bgBuffer = await sharp(inputBuffer)
        .resize(storyWidth, storyHeight, { fit: 'cover' })
        .blur(25)
        .modulate({ brightness: 0.6 })
        .toBuffer();

      // 2. Redimensionar imagen para centrarla dentro del canvas 9:16
      const postBuffer = await sharp(inputBuffer)
        .resize(920, 1300, { fit: 'inside' })
        .toBuffer();

      const postMeta = await sharp(postBuffer).metadata();
      const left = Math.round((storyWidth - postMeta.width) / 2);
      const top = Math.round((storyHeight - postMeta.height) / 2);

      baseCanvasBuffer = await sharp(bgBuffer)
        .composite([
          {
            input: postBuffer,
            top,
            left,
            blend: 'over'
          }
        ])
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    // 3. Si se solicitó el sticker de música estilo Instagram
    if (addMusicSticker && (songTitle || songArtist)) {
      const cleanTitle = (songTitle || 'Audio Original').replace(/[<>&"]/g, '');
      const cleanArtist = (songArtist || 'MetaPulse Music').replace(/[<>&"]/g, '');

      // Sticker SVG de diseño moderno estilo Instagram Story Music Tag
      const stickerSvg = Buffer.from(`
        <svg width="600" height="90" viewBox="0 0 600 90" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="stickerBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0f172a" stop-opacity="0.88" />
              <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.92" />
            </linearGradient>
            <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ec4899" />
              <stop offset="100%" stop-color="#8b5cf6" />
            </linearGradient>
          </defs>
          <!-- Contenedor con borde neón sutil -->
          <rect x="2" y="2" width="596" height="86" rx="43" fill="url(#stickerBg)" stroke="rgba(236,72,153,0.6)" stroke-width="2.5" />
          
          <!-- Círculo de vinilo/nota musical -->
          <circle cx="48" cy="45" r="28" fill="url(#accentGrad)" />
          <text x="48" y="53" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle">🎵</text>
          
          <!-- Textos de la canción -->
          <text x="92" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${cleanTitle}</text>
          <text x="92" y="64" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#cbd5e1">${cleanArtist} • Instagram Audio</text>

          <!-- Iconos de ondas de sonido -->
          <rect x="520" y="35" width="4" height="20" rx="2" fill="#ec4899" />
          <rect x="530" y="28" width="4" height="34" rx="2" fill="#a855f7" />
          <rect x="540" y="40" width="4" height="12" rx="2" fill="#8b5cf6" />
          <rect x="550" y="32" width="4" height="26" rx="2" fill="#ec4899" />
          <rect x="560" y="38" width="4" height="15" rx="2" fill="#a855f7" />
        </svg>
      `);

      // Posicionar el sticker centrado cerca de la parte inferior (a 240px del borde inferior)
      const stickerLeft = Math.round((storyWidth - 600) / 2);
      const stickerTop = storyHeight - 240;

      baseCanvasBuffer = await sharp(baseCanvasBuffer)
        .composite([
          {
            input: stickerSvg,
            top: stickerTop,
            left: stickerLeft,
            blend: 'over'
          }
        ])
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    const readyImagePath = path.join(this.tempDir, `canvas_${Date.now()}_story.jpg`);
    fs.writeFileSync(readyImagePath, baseCanvasBuffer);
    return readyImagePath;
  }

  /**
   * Genera un Video MP4 vertical 9:16 (1080x1920) a partir de una imagen y una pista de audio
   * para publicar en Instagram Stories y Facebook Stories con sonido real
   */
  async generateStoryVideo({
    imageInput,
    audioInput,
    duration = 15,
    startTime = 0,
    addMusicSticker = false,
    songTitle = '',
    songArtist = ''
  }) {
    let resolvedImage = null;
    let preparedCanvasPath = null;

    try {
      // 1. Resolver y preparar la imagen 9:16 1080x1920
      resolvedImage = await this.resolveImageToLocal(imageInput);
      preparedCanvasPath = await this.prepareStoryCanvas({
        imagePath: resolvedImage.path,
        addMusicSticker,
        songTitle,
        songArtist
      });

      // 2. Resolver y asegurar el audio en local
      const localAudioPath = await musicService.ensureTrackCached(audioInput);

      // 3. Definir archivo de salida
      const outputFilename = `story_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
      const outputPath = path.join(this.storiesDir, outputFilename);

      const parsedDuration = Math.min(Math.max(Number(duration) || 15, 3), 60);
      const parsedStart = Math.max(Number(startTime) || 0, 0);

      // 4. Parámetros de FFmpeg para máxima compatibilidad con Meta Graph API (Instagram/Facebook)
      // H.264 (yuv420p) + AAC audio stereo 192k 44.1kHz con +faststart (moov atom al inicio)
      const args = [
        '-y',
        '-loop', '1',
        '-framerate', '30',
        '-i', preparedCanvasPath,
        '-ss', String(parsedStart),
        '-t', String(parsedDuration),
        '-i', localAudioPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-shortest',
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`[VideoService] Ejecutando FFmpeg para generar Story Video de ${parsedDuration}s...`);

      await new Promise((resolve, reject) => {
        execFile(this.getFFmpegBinary(), args, (error, stdout, stderr) => {
          if (error) {
            console.error('[VideoService] Error en FFmpeg:', stderr || error.message);
            return reject(new Error(`Error en codificación FFmpeg: ${error.message}`));
          }
          resolve();
        });
      });

      const stat = fs.statSync(outputPath);
      console.log(`[VideoService] Video generado con éxito: ${outputFilename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        filename: outputFilename,
        outputPath,
        relativeUrl: `/uploads/stories/${outputFilename}`,
        duration: parsedDuration,
        width: 1080,
        height: 1920,
        sizeBytes: stat.size
      };
    } finally {
      // Limpieza de archivos temporales
      if (preparedCanvasPath && fs.existsSync(preparedCanvasPath)) {
        try { fs.unlinkSync(preparedCanvasPath); } catch (_) {}
      }
      if (resolvedImage && resolvedImage.isTemp && fs.existsSync(resolvedImage.path)) {
        try { fs.unlinkSync(resolvedImage.path); } catch (_) {}
      }
    }
  }
}

module.exports = new VideoService();
