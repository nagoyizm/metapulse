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
   * Ejecuta un comando FFmpeg mediante execFile devolviendo una Promesa
   */
  runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const ffmpegBin = this.getFFmpegBinary();
      console.log(`[VideoService] Ejecutando FFmpeg: ${ffmpegBin}`);
      execFile(ffmpegBin, args, (error, stdout, stderr) => {
        if (error) {
          console.error('[VideoService] Error en FFmpeg:', stderr || error.message);
          return reject(new Error(`Error en codificación FFmpeg: ${stderr || error.message}`));
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Resuelve cualquier ruta o URL de imagen a un archivo local absoluto
   */
  async resolveImageToLocal(imageInput) {
    if (!imageInput || typeof imageInput !== 'string') {
      throw new Error('Ruta de imagen no proporcionada o inválida.');
    }

    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const tempImg = path.join(this.tempDir, `download_${Date.now()}_img.jpg`);
      const resp = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 25000 });
      fs.writeFileSync(tempImg, Buffer.from(resp.data));
      return { path: tempImg, isTemp: true };
    }

    // Quitar query params si los tuviera (ej: ?t=123)
    const urlWithoutQuery = imageInput.split('?')[0];
    const cleanRel = urlWithoutQuery.replace(/^[\\\/]+/, '');
    const baseName = path.basename(cleanRel);

    const candidates = [
      // 1. Relativo a la raíz del proyecto
      path.join(__dirname, '../../', cleanRel),
      // 2. En uploads/processed (muy común para imágenes adaptadas o marcas de agua)
      path.join(__dirname, '../../uploads/processed', baseName),
      // 3. En uploads directo
      path.join(__dirname, '../../uploads', baseName),
      // 4. En uploads/watermarks
      path.join(__dirname, '../../uploads/watermarks', baseName),
      // 5. En uploads/generated
      path.join(__dirname, '../../uploads/generated', baseName),
      // 6. En uploads/stories
      path.join(__dirname, '../../uploads/stories', baseName),
      // 7. Ruta directa si ya era absoluta en el disco
      urlWithoutQuery
    ];

    const extensions = ['', '.jpg', '.jpeg', '.png', '.webp'];
    for (const cand of candidates) {
      for (const ext of extensions) {
        const fullCand = cand + ext;
        if (fullCand && fs.existsSync(fullCand) && !fs.statSync(fullCand).isDirectory()) {
          return { path: fullCand, isTemp: false };
        }
      }
    }

    // Búsqueda por prefijo si el nombre fue recortado o truncado
    const searchDirs = [
      path.join(__dirname, '../../uploads/processed'),
      path.join(__dirname, '../../uploads'),
      path.join(__dirname, '../../uploads/watermarks'),
      path.join(__dirname, '../../uploads/generated'),
      path.join(__dirname, '../../uploads/stories')
    ];

    for (const sDir of searchDirs) {
      if (fs.existsSync(sDir)) {
        const files = fs.readdirSync(sDir);
        const match = files.find(f => f === baseName || f.startsWith(baseName));
        if (match) {
          const foundPath = path.join(sDir, match);
          if (fs.existsSync(foundPath) && !fs.statSync(foundPath).isDirectory()) {
            return { path: foundPath, isTemp: false };
          }
        }
      }
    }

    throw new Error(`No se encontró el archivo de imagen: ${imageInput}`);
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

      // 2. Redimensionar imagen para centrarla dentro del canvas 9:16 sin recortar bordes
      const postBuffer = await sharp(inputBuffer)
        .resize(920, 1300, { fit: 'inside' })
        .toBuffer();

      const postMeta = await sharp(postBuffer).metadata();
      const left = Math.round((storyWidth - postMeta.width) / 2);
      const top = Math.round((storyHeight - postMeta.height) / 2);

      // Máscara con esquinas redondeadas y marco sutil estilo Instagram Story Post Share
      const radius = 24;
      const maskSvg = Buffer.from(
        `<svg width="${postMeta.width}" height="${postMeta.height}"><rect x="0" y="0" width="${postMeta.width}" height="${postMeta.height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
      );

      const roundedPost = await sharp(postBuffer)
        .composite([{ input: maskSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();

      const shadowMargin = 15;
      const shadowSvg = Buffer.from(
        `<svg width="${postMeta.width + shadowMargin * 2}" height="${postMeta.height + shadowMargin * 2}">
          <defs>
            <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#000000" flood-opacity="0.55"/>
            </filter>
          </defs>
          <rect x="${shadowMargin}" y="${shadowMargin}" width="${postMeta.width}" height="${postMeta.height}" rx="${radius}" ry="${radius}" fill="rgba(0,0,0,0.3)" filter="url(#cardShadow)"/>
          <rect x="${shadowMargin}" y="${shadowMargin}" width="${postMeta.width}" height="${postMeta.height}" rx="${radius}" ry="${radius}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
        </svg>`
      );

      baseCanvasBuffer = await sharp(bgBuffer)
        .composite([
          {
            input: shadowSvg,
            top: top - shadowMargin,
            left: left - shadowMargin,
            blend: 'over'
          },
          {
            input: roundedPost,
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

  /**
   * Prepara una imagen para Video de Feed (1:1, 4:5, etc.) manteniendo su resolución y relación de aspecto original
   * asegurando dimensiones pares (requerido por codificador H.264 / yuv420p).
   * Para Posts de Feed NUNCA se superpone etiqueta ni sticker sobre la imagen para mantenerla 100% limpia.
   */
  async prepareFeedCanvas({ imagePath }) {
    const inputBuffer = fs.readFileSync(imagePath);
    let imageSharp = sharp(inputBuffer);
    const meta = await imageSharp.metadata();

    let targetWidth = meta.width;
    let targetHeight = meta.height;

    // FFmpeg H.264 (yuv420p) requiere dimensiones pares
    const needsResize = (targetWidth % 2 !== 0) || (targetHeight % 2 !== 0);
    if (needsResize) {
      targetWidth = targetWidth - (targetWidth % 2);
      targetHeight = targetHeight - (targetHeight % 2);
      imageSharp = imageSharp.resize(targetWidth, targetHeight, { fit: 'fill' });
    }

    const canvasBuffer = await imageSharp.jpeg({ quality: 95 }).toBuffer();

    const readyImagePath = path.join(this.tempDir, `canvas_${Date.now()}_feed.jpg`);
    fs.writeFileSync(readyImagePath, canvasBuffer);
    return { path: readyImagePath, width: targetWidth, height: targetHeight };
  }

  /**
   * Genera un Video MP4 para Feed preservando el tamaño y aspecto original de la imagen (1:1, 4:5, etc.)
   * con pista de audio embebida para publicarse como Post en Facebook e Instagram.
   * La imagen se mantiene 100% intacta sin etiquetas ni stickers superpuestos.
   */
  async generateFeedVideo({
    imageInput,
    audioInput,
    duration = 15,
    startTime = 0
  }) {
    let resolvedImage = null;
    let preparedCanvas = null;

    try {
      resolvedImage = await this.resolveImageToLocal(imageInput);
      preparedCanvas = await this.prepareFeedCanvas({
        imagePath: resolvedImage.path
      });

      const localAudioPath = await musicService.ensureTrackCached(audioInput);

      const outputFilename = `feed_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
      const outputPath = path.join(this.storiesDir, outputFilename);

      const parsedDuration = Math.min(Math.max(Number(duration) || 15, 3), 90);
      const parsedStart = Math.max(Number(startTime) || 0, 0);

      const args = [
        '-y',
        '-loop', '1',
        '-framerate', '30',
        '-i', preparedCanvas.path,
        '-ss', String(parsedStart),
        '-t', String(parsedDuration),
        '-i', localAudioPath,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-movflags', '+faststart',
        outputPath
      ];

      await this.runFFmpeg(args);

      const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : { size: 0 };

      return {
        success: true,
        outputPath,
        relativeUrl: `/uploads/stories/${outputFilename}`,
        filename: outputFilename,
        duration: parsedDuration,
        width: preparedCanvas.width,
        height: preparedCanvas.height,
        aspectRatio: `${preparedCanvas.width}:${preparedCanvas.height}`,
        sizeBytes: stat.size,
        isFeedVideo: true
      };
    } finally {
      if (preparedCanvas && fs.existsSync(preparedCanvas.path)) {
        try { fs.unlinkSync(preparedCanvas.path); } catch (_) {}
      }
      if (resolvedImage && resolvedImage.isTemp && fs.existsSync(resolvedImage.path)) {
        try { fs.unlinkSync(resolvedImage.path); } catch (_) {}
      }
    }
  }

  /**
   * Obtiene las dimensiones (ancho y alto) de un video usando FFmpeg
   */
  getVideoDimensions(videoPath) {
    return new Promise((resolve) => {
      const ffmpegBin = this.getFFmpegBinary();
      execFile(ffmpegBin, ['-i', videoPath], (err, stdout, stderr) => {
        const output = (stderr || '') + (stdout || '');
        const match = output.match(/Stream.*Video:.*,\s*(\d{2,5})x(\d{2,5})/);
        if (match) {
          resolve({ width: parseInt(match[1], 10), height: parseInt(match[2], 10) });
        } else {
          resolve({ width: 0, height: 0 });
        }
      });
    });
  }

  /**
   * Convierte cualquier video (Feed 4:5, Cuadrado 1:1, etc.) a formato vertical 9:16 (1080x1920)
   * estilo Historia de Instagram, con fondo difuminado y el video original centrado
   * dentro del espacio de 16:9 sin recortar ningún detalle del post.
   */
  async convertVideoToStoryVideo({ videoInput, duration = null }) {
    let resolvedVideo = null;
    try {
      resolvedVideo = await this.resolveImageToLocal(videoInput);
      const localVideoPath = resolvedVideo.path;

      // Verificar si ya tiene dimensiones exactas 1080x1920
      const dims = await this.getVideoDimensions(localVideoPath);
      if (dims.width === 1080 && dims.height === 1920) {
        return {
          success: true,
          filename: path.basename(localVideoPath),
          outputPath: localVideoPath,
          relativeUrl: videoInput.startsWith('/') ? videoInput : `/uploads/stories/${path.basename(localVideoPath)}`,
          width: 1080,
          height: 1920
        };
      }

      const outputFilename = `story_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
      const outputPath = path.join(this.storiesDir, outputFilename);

      // Filtro FFmpeg profesional:
      // Fondo: escala para cubrir 1080x1920, recorta a 1080x1920, desenfoque de caja (blur), brillo atenuado
      // Primer plano: escala para encajar dentro de 920x1300 preservando aspecto original sin recortar
      // Superposición: centrada vertical y horizontalmente
      const filter = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5,eq=brightness=-0.1[bg];[0:v]scale=920:1300:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]';

      const args = [
        '-y',
        '-i', localVideoPath,
        '-filter_complex', filter,
        '-map', '[outv]',
        '-map', '0:a?', // copiar audio original si existe
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '44100',
        '-ac', '2',
        '-movflags', '+faststart'
      ];

      if (duration) {
        args.push('-t', String(duration));
      }

      args.push(outputPath);

      console.log(`[VideoService] Convirtiendo video a Story 9:16 (1080x1920): ${outputFilename}`);
      await this.runFFmpeg(args);

      const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : { size: 0 };
      console.log(`[VideoService] Story Video generado con éxito: ${outputFilename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        filename: outputFilename,
        outputPath,
        relativeUrl: `/uploads/stories/${outputFilename}`,
        width: 1080,
        height: 1920,
        sizeBytes: stat.size
      };
    } finally {
      if (resolvedVideo && resolvedVideo.isTemp && fs.existsSync(resolvedVideo.path)) {
        try { fs.unlinkSync(resolvedVideo.path); } catch (_) {}
      }
    }
  }

  /**
   * Router unificado: genera video de Story (9:16) o de Feed (dimensiones originales)
   */
  async generatePostVideo({
    imageInput,
    audioInput,
    postType = 'feed',
    duration = 15,
    startTime = 0,
    addMusicSticker = false,
    songTitle = '',
    songArtist = ''
  }) {
    const isVideo = Boolean(imageInput && (imageInput.endsWith('.mp4') || imageInput.endsWith('.mov') || imageInput.includes('/uploads/stories/')));

    if (postType === 'story') {
      if (isVideo) {
        return this.convertVideoToStoryVideo({
          videoInput: imageInput,
          duration
        });
      }
      return this.generateStoryVideo({
        imageInput,
        audioInput,
        duration,
        startTime,
        addMusicSticker,
        songTitle,
        songArtist
      });
    } else {
      // Para posts de Feed u otros formatos que no sean stories, la imagen NUNCA lleva etiqueta de música
      return this.generateFeedVideo({
        imageInput,
        audioInput,
        duration,
        startTime
      });
    }
  }
}

module.exports = new VideoService();
