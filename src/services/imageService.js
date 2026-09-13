const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class ImageService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads');
    this.watermarksDir = path.join(this.uploadsDir, 'watermarks');
    this.processedDir = path.join(this.uploadsDir, 'processed');

    [this.uploadsDir, this.watermarksDir, this.processedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Obtiene metadatos de una imagen (ancho, alto, formato, peso)
   */
  async getImageMetadata(inputPath) {
    const meta = await sharp(inputPath).metadata();
    const stats = fs.statSync(inputPath);
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      size: stats.size,
      aspectRatio: (meta.width / meta.height).toFixed(2)
    };
  }

  /**
   * Aplica un logotipo o marca de agua sobre una imagen base
   * @param {Object} options
   * @param {string} options.inputImagePath - Ruta a la imagen base
   * @param {string} options.watermarkPath - Ruta al logo PNG
   * @param {string} [options.position='bottom-right'] - 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'
   * @param {number} [options.opacity=0.85] - Opacidad del logo (0.1 a 1.0)
   * @param {number} [options.scalePercent=18] - Porcentaje del ancho de la imagen para el logo
   * @param {number} [options.marginPercent=3] - Margen respecto al borde en porcentaje
   */
  async applyWatermark({
    inputImagePath,
    watermarkPath,
    position = 'bottom-right',
    opacity = 0.85,
    scalePercent = 18,
    marginPercent = 3,
    xPercent = null,
    yPercent = null
  }) {
    // 1. Resolver ruta de imagen base con soporte para URLs y rutas relativas
    let resolvedInputPath = inputImagePath;
    if (resolvedInputPath.startsWith('http://') || resolvedInputPath.startsWith('https://')) {
      try {
        const parsedUrl = new URL(resolvedInputPath);
        resolvedInputPath = path.join(__dirname, '../../', parsedUrl.pathname.replace(/^\/+/, ''));
      } catch (_) {}
    } else if (!path.isAbsolute(resolvedInputPath)) {
      resolvedInputPath = path.join(__dirname, '../../', resolvedInputPath.replace(/^\/+/, ''));
    }

    if (!fs.existsSync(resolvedInputPath)) {
      const baseFilename = path.basename(resolvedInputPath);
      const candidates = [
        path.join(this.processedDir, baseFilename),
        path.join(this.uploadsDir, baseFilename),
        path.join(this.uploadsDir, 'generated', baseFilename),
        path.join(this.uploadsDir, 'media', baseFilename),
        path.join(this.uploadsDir, 'watermarks', baseFilename)
      ];
      const found = candidates.find(c => fs.existsSync(c));
      if (found) {
        resolvedInputPath = found;
      } else {
        throw new Error(`La imagen base no existe: ${inputImagePath}`);
      }
    }

    // 2. Resolver ruta de marca de agua / logotipo
    let resolvedWatermarkPath = watermarkPath;
    if (!path.isAbsolute(resolvedWatermarkPath)) {
      resolvedWatermarkPath = path.join(__dirname, '../../', resolvedWatermarkPath.replace(/^\/+/, ''));
    }
    if (!fs.existsSync(resolvedWatermarkPath)) {
      const fallbackWm = path.join(__dirname, '../../uploads/watermarks', path.basename(resolvedWatermarkPath));
      if (fs.existsSync(fallbackWm)) {
        resolvedWatermarkPath = fallbackWm;
      } else {
        throw new Error(`El logotipo/marca de agua no existe: ${watermarkPath}`);
      }
    }

    const baseMeta = await sharp(resolvedInputPath).metadata();
    const baseWidth = baseMeta.width;
    const baseHeight = baseMeta.height;

    // Calcular tamaño proporcional del logo
    const targetLogoWidth = Math.max(30, Math.round(baseWidth * (scalePercent / 100)));
    const margin = Math.round(baseWidth * (marginPercent / 100));

    // Redimensionar logo y asegurar canal alpha
    let logoBuffer = await sharp(watermarkPath)
      .resize({ width: targetLogoWidth, fit: 'inside' })
      .ensureAlpha()
      .toBuffer();

    // Aplicar opacidad real con multiplicación de canal alpha si opacity < 1
    const parsedOpacity = Number(opacity);
    if (!isNaN(parsedOpacity) && parsedOpacity < 1 && parsedOpacity > 0) {
      const alphaVal = Math.max(0, Math.min(255, Math.round(parsedOpacity * 255)));
      const alphaMask = Buffer.from([255, 255, 255, alphaVal]);
      logoBuffer = await sharp(logoBuffer)
        .composite([{ input: alphaMask, raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
        .png()
        .toBuffer();
    }

    const logoMeta = await sharp(logoBuffer).metadata();
    const logoWidth = logoMeta.width;
    const logoHeight = logoMeta.height;

    // Calcular coordenadas [left, top]
    let left = margin;
    let top = margin;

    if (xPercent !== null && xPercent !== undefined && yPercent !== null && yPercent !== undefined) {
      left = Math.round(baseWidth * (Number(xPercent) / 100));
      top = Math.round(baseHeight * (Number(yPercent) / 100));
    } else {
      switch (position) {
        case 'top-left':
          left = margin;
          top = margin;
          break;
        case 'top-right':
          left = baseWidth - logoWidth - margin;
          top = margin;
          break;
        case 'bottom-left':
          left = margin;
          top = baseHeight - logoHeight - margin;
          break;
        case 'center':
          left = Math.round((baseWidth - logoWidth) / 2);
          top = Math.round((baseHeight - logoHeight) / 2);
          break;
        case 'bottom-right':
        default:
          left = baseWidth - logoWidth - margin;
          top = baseHeight - logoHeight - margin;
          break;
      }
    }

    // Asegurar que no quede fuera de los límites
    left = Math.max(0, Math.min(left, baseWidth - logoWidth));
    top = Math.max(0, Math.min(top, baseHeight - logoHeight));

    // Generar archivo de salida único
    const outputFilename = `wm_${Date.now()}_${path.basename(inputImagePath)}`;
    const outputPath = path.join(this.processedDir, outputFilename);

    // Crear sombra suave y realista bajo el logo (estilo sticker comercial integrado)
    const compositeLayers = [];
    if (parsedOpacity > 0.35) {
      try {
        const shadowBuffer = await sharp(logoBuffer)
          .ensureAlpha()
          .linear(0, 0)
          .blur(Math.max(3, Math.round(targetLogoWidth * 0.025)))
          .png()
          .toBuffer();

        compositeLayers.push({
          input: shadowBuffer,
          top: Math.min(baseHeight - logoHeight, Math.round(top + Math.max(2, Math.round(targetLogoWidth * 0.015)))),
          left: Math.min(baseWidth - logoWidth, Math.round(left + Math.max(1, Math.round(targetLogoWidth * 0.01)))),
          blend: 'over'
        });
      } catch (sErr) {
        console.warn('No se pudo generar sombra de marca de agua:', sErr.message);
      }
    }

    compositeLayers.push({
      input: logoBuffer,
      top: Math.round(top),
      left: Math.round(left),
      blend: 'over'
    });

    await sharp(resolvedInputPath)
      .composite(compositeLayers)
      .jpeg({ quality: 92 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`,
      width: baseWidth,
      height: baseHeight
    };
  }

  /**
   * Ajusta el formato de una imagen para redes sociales (1:1, 4:5, 9:16)
   */
  async formatForSocialMedia(inputImagePath, preset = 'square') {
    let targetWidth = 1080;
    let targetHeight = 1080;

    if (preset === 'portrait' || preset === 'feed-4-5') {
      targetWidth = 1080;
      targetHeight = 1350; // Instagram Portrait 4:5
    } else if (preset === 'story' || preset === 'reel' || preset === '9-16') {
      targetWidth = 1080;
      targetHeight = 1920; // Instagram Story / Reel 9:16
    }

    const outputFilename = `fit_${preset}_${Date.now()}_${path.basename(inputImagePath)}`;
    const outputPath = path.join(this.processedDir, outputFilename);

    await sharp(inputImagePath)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 } // Fondo oscuro refinado
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`
    };
  }

  /**
   * Crea una imagen vertical 9:16 (1080x1920) estilo Historia a partir de un post
   * con fondo artístico difuminado y el post centrado listo para Instagram / Facebook Story
   */
  async createStoryCard({ inputImagePath, brandName = '' }) {
    let inputBuffer = null;
    let baseName = 'story';

    if (inputImagePath.startsWith('http://') || inputImagePath.startsWith('https://')) {
      const axios = require('axios');
      const resp = await axios.get(inputImagePath, { responseType: 'arraybuffer' });
      inputBuffer = Buffer.from(resp.data);
      baseName = 'remote_post';
    } else {
      if (!fs.existsSync(inputImagePath)) {
        throw new Error(`La imagen no existe: ${inputImagePath}`);
      }
      inputBuffer = fs.readFileSync(inputImagePath);
      baseName = path.basename(inputImagePath, path.extname(inputImagePath));
    }

    const storyWidth = 1080;
    const storyHeight = 1920;

    // 1. Crear fondo difuminado 1080x1920
    const bgBuffer = await sharp(inputBuffer)
      .resize(storyWidth, storyHeight, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.55 })
      .toBuffer();

    // 2. Redimensionar la imagen del post para centrarla
    const postBuffer = await sharp(inputBuffer)
      .resize(920, 1200, { fit: 'inside' })
      .toBuffer();

    const postMeta = await sharp(postBuffer).metadata();
    const left = Math.round((storyWidth - postMeta.width) / 2);
    const top = Math.round((storyHeight - postMeta.height) / 2);

    const outputFilename = `story_${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    const outputPath = path.join(this.processedDir, outputFilename);

    await sharp(bgBuffer)
      .composite([
        {
          input: postBuffer,
          top: top,
          left: left,
          blend: 'over'
        }
      ])
      .jpeg({ quality: 92 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`
    };
  }

  /**
   * Genera un póster publicitario profesional vertical 4:5 (1080x1350)
   * Realza la foto del producto, añade fondo envolvente difuminado y monta tipografía publicitaria vectorial nítida
   */
  async createAdvertisingPoster({
    inputImagePath,
    headline = 'PRODUCTO DESTACADO',
    badgeText = '',
    subline = '',
    features = [],
    ctaText = '',
    brandName = ''
  }) {
    let inputBuffer = null;
    let baseName = 'poster';

    if (inputImagePath.startsWith('http://') || inputImagePath.startsWith('https://')) {
      const axios = require('axios');
      const resp = await axios.get(inputImagePath, { responseType: 'arraybuffer' });
      inputBuffer = Buffer.from(resp.data);
      baseName = 'remote_product';
    } else {
      const absPath = path.isAbsolute(inputImagePath) ? inputImagePath : path.join(__dirname, '../../', inputImagePath.replace(/^\/+/, ''));
      if (!fs.existsSync(absPath)) {
        throw new Error(`La imagen no existe: ${absPath}`);
      }
      inputBuffer = fs.readFileSync(absPath);
      baseName = path.basename(absPath, path.extname(absPath));
    }

    const width = 1080;
    const height = 1350; // Proporción 4:5 vertical ideal para Instagram

    const isCampina = (brandName || '').toLowerCase().includes('campiña') || (brandName || '').toLowerCase().includes('cabaña');

    // 1. Fondo difuminado con realce de atmósfera
    const bgBuffer = await sharp(inputBuffer)
      .resize(width, height, { fit: 'cover' })
      .blur(35)
      .modulate({ brightness: 0.42, saturation: 1.25 })
      .toBuffer();

    // 2. Foto principal del producto/cabaña centrada y optimizada
    const maxProductWidth = 920;
    const maxProductHeight = 840;
    const productBuffer = await sharp(inputBuffer)
      .resize(maxProductWidth, maxProductHeight, { fit: 'inside' })
      .modulate({ brightness: 1.06, saturation: 1.15 })
      .toBuffer();

    const prodMeta = await sharp(productBuffer).metadata();
    const prodLeft = Math.round((width - prodMeta.width) / 2);
    const prodTop = 235;

    // Colores de marca
    const accentGradStart = isCampina ? '#10B981' : '#F59E0B';
    const accentGradEnd = isCampina ? '#059669' : '#EA580C';
    const badgeStroke = isCampina ? '#10B981' : '#F59E0B';
    const badgeTextFill = isCampina ? '#6EE7B7' : '#FBBF24';

    const defaultBadge = isCampina ? '🌲 CABAÑAS LA CAMPIÑA · ALGARROBO' : '🇰🇷 K-FOOD EXCLUSIVO EN ALGARROBO';
    const finalBadge = (badgeText || defaultBadge).toUpperCase();

    const defaultCta = isCampina
      ? '📲 Reservas WhatsApp: +56 9 7900 4253 · Algarrobo'
      : '📍 El Boldo 366, Local 13 · Espacio Algarrobo';
    const finalCta = ctaText || defaultCta;

    // Renderizado de pastillas de características
    let featuresXml = '';
    const safeFeatures = features && features.length > 0 ? features.slice(0, 3) : (
      isCampina
        ? ['🔥 Quincho en Terraza', '🌲 Áreas Verdes', '✨ Desconexión']
        : ['🍦 Suave & Cremoso', '🐟 100% Coreano', '❄️ ¡Bien Frío!']
    );

    const pillWidth = 200;
    const totalPillsWidth = safeFeatures.length * (pillWidth + 16);
    const startX = Math.round((width - totalPillsWidth) / 2);

    featuresXml = safeFeatures.map((f, i) => {
      const px = startX + i * (pillWidth + 16);
      return `
        <g transform="translate(${px}, ${height - 145})">
          <rect x="0" y="-18" width="${pillWidth}" height="36" rx="18" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.32)" stroke-width="1.5"/>
          <text x="${pillWidth / 2}" y="6" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle">
            ${f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </text>
        </g>
      `;
    }).join('');

    const safeHeadline = (headline || 'PRODUCTO DESTACADO')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubline = (subline || (isCampina ? 'Vive una experiencia única en el Litoral Central' : 'El auténtico sabor importado que tienes que probar'))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 3. Capa vectorial SVG con sombras y tipografía
    const svgOverlay = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.88"/>
            <stop offset="60%" stop-color="#000000" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bottomShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="40%" stop-color="#000000" stop-opacity="0.65"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.95"/>
          </linearGradient>
          <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${accentGradStart}"/>
            <stop offset="100%" stop-color="${accentGradEnd}"/>
          </linearGradient>
        </defs>

        <!-- Sombra superior para legibilidad -->
        <rect x="0" y="0" width="${width}" height="280" fill="url(#topShadow)"/>

        <!-- Sombra inferior para textos -->
        <rect x="0" y="${height - 390}" width="${width}" height="390" fill="url(#bottomShadow)"/>

        <!-- Pastilla Badge Superior -->
        <g transform="translate(${width / 2}, 65)">
          <rect x="-260" y="-22" width="520" height="44" rx="22" fill="#111827" stroke="${badgeStroke}" stroke-width="2.5"/>
          <text x="0" y="7" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="900" fill="${badgeTextFill}" text-anchor="middle" letter-spacing="1.5">
            ${finalBadge}
          </text>
        </g>

        <!-- Titular Principal Superior -->
        <text x="${width / 2}" y="172" font-family="'Segoe UI', Impact, Arial, sans-serif" font-size="50" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1.5">
          ${safeHeadline}
        </text>

        <!-- Borde sutil del producto -->
        <rect x="${prodLeft - 6}" y="${prodTop - 6}" width="${prodMeta.width + 12}" height="${prodMeta.height + 12}" rx="14" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>

        <!-- Subtítulo inferior -->
        <text x="${width / 2}" y="${height - 200}" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="700" fill="#F3F4F6" text-anchor="middle">
          ${safeSubline}
        </text>

        <!-- Pastillas de características -->
        ${featuresXml}

        <!-- Barra inferior CTA -->
        <g transform="translate(0, ${height - 75})">
          <rect x="0" y="0" width="${width}" height="75" fill="url(#ctaGrad)"/>
          <text x="${width / 2}" y="47" font-family="'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.8">
            ${finalCta.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </text>
        </g>
      </svg>
    `;

    const svgBuffer = Buffer.from(svgOverlay);

    const outputFilename = `poster_4x5_${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    const outputPath = path.join(this.processedDir, outputFilename);

    await sharp(bgBuffer)
      .composite([
        {
          input: productBuffer,
          top: prodTop,
          left: prodLeft
        },
        {
          input: svgBuffer,
          top: 0,
          left: 0
        }
      ])
      .jpeg({ quality: 92 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`,
      width,
      height
    };
  }

  /**
   * Genera un Flyer Editorial 4:5 sobre una foto real (Especial para Cabañas La Campiña)
   * Inspirado en la estética sobria, tipografía limpia y jerarquía visual de canvas-design.
   */
  async createEditorialCampinaFlyer({
    inputImagePath,
    headline = 'DESCONEXIÓN TOTAL',
    subline = 'Quinchos privados • Cabañas familiares y suites • Algarrobo',
    badgeText = 'CABAÑAS LA CAMPIÑA • ALGARROBO',
    style = 'editorial',
    typographyStyle = 'rustic_timber',
    brandTreatment = 'auto',
    colorPalette = 'auto'
  }) {
    if (!fs.existsSync(inputImagePath)) {
      throw new Error(`La imagen base no existe: ${inputImagePath}`);
    }

    const width = 1080;
    const height = 1350; // Relación 4:5 ideal para Feed de Instagram

    // 1. Redimensionar y ajustar la foto real a 1080x1350 con recorte inteligente centrado
    const basePhotoBuffer = await sharp(inputImagePath)
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer();

    const safeHeadline = (headline || 'DESCONEXIÓN EN LA NATURALEZA')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubline = (subline || 'Quinchos privados • Bosque de pinos • Desconexión familiar')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeBadge = (badgeText || 'CABAÑAS LA CAMPIÑA • ALGARROBO')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 2. Configuración específica según estilo tipográfico seleccionado
    const chosenStyle = typographyStyle || (style === 'rustic' ? 'rustic_timber' : (style === 'nature' ? 'natgeo_adventure' : 'kinfolk_luxury'));
    const isPatriaTopic = chosenStyle === 'patria_heritage' || safeHeadline.includes('18') || safeHeadline.toLowerCase().includes('patria');
    const activePalette = (!colorPalette || colorPalette === 'auto')
      ? (isPatriaTopic ? 'patria_chilena' : (chosenStyle === 'kinfolk_luxury' ? 'kinfolk_ivory' : (chosenStyle === 'rustic_timber' ? 'fuego_quincho' : 'tierra_bosque')))
      : colorPalette;

    const activeTreatment = (!brandTreatment || brandTreatment === 'auto')
      ? (activePalette === 'kinfolk_ivory' ? 'gold_foil' : (activePalette === 'patria_chilena' || activePalette === 'fuego_quincho' ? 'brush_stroke' : 'editorial_lockup'))
      : brandTreatment;
    
    let titleFont = "'Instrument Serif', 'Georgia', 'Playfair Display', serif";
    let titleSize = 60;
    let titleWeight = 700;
    let titleLetterSpacing = '2px';
    let titleColor = '#FFFFFF';
    let badgeBorder = 'rgba(255, 255, 255, 0.35)';
    let dividerColor = 'rgba(255, 255, 255, 0.45)';
    let filterDefs = '';
    let filterAttr = 'filter="url(#subtleGlow)"';

    if (chosenStyle === 'rustic_timber') {
      titleFont = "'Cinzel Decorative', 'Cinzel', 'Georgia', serif";
      titleSize = 54;
      titleWeight = 800;
      titleLetterSpacing = '2.5px';
      titleColor = '#FFF8EE';
      badgeBorder = 'rgba(217, 119, 6, 0.6)';
      dividerColor = 'rgba(217, 119, 6, 0.7)';
      filterDefs = `
        <filter id="timberShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#220D00" flood-opacity="0.95"/>
          <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      `;
      filterAttr = 'filter="url(#timberShadow)"';
    } else if (chosenStyle === 'kinfolk_luxury') {
      titleFont = "'Instrument Serif', 'Playfair Display', 'Bodoni MT', serif";
      titleSize = 64;
      titleWeight = 400;
      titleLetterSpacing = '3.5px';
      titleColor = '#FFFFFF';
      badgeBorder = 'rgba(255, 255, 255, 0.4)';
      dividerColor = 'rgba(255, 255, 255, 0.55)';
      filterDefs = `
        <filter id="luxuryGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.85"/>
        </filter>
      `;
      filterAttr = 'filter="url(#luxuryGlow)"';
    } else if (chosenStyle === 'natgeo_adventure') {
      titleFont = "'Outfit', 'Impact', 'Arial Black', sans-serif";
      titleSize = 66;
      titleWeight = 900;
      titleLetterSpacing = '0.5px';
      titleColor = '#FFFFFF';
      badgeBorder = 'rgba(16, 185, 129, 0.7)';
      dividerColor = 'rgba(16, 185, 129, 0.85)';
      filterDefs = `
        <filter id="deepSolidShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.95"/>
        </filter>
      `;
      filterAttr = 'filter="url(#deepSolidShadow)"';
    } else if (chosenStyle === 'botanical_minimal') {
      titleFont = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif";
      titleSize = 42;
      titleWeight = 300;
      titleLetterSpacing = '7px';
      titleColor = '#F8FAFC';
      badgeBorder = 'rgba(14, 165, 233, 0.5)';
      dividerColor = 'rgba(14, 165, 233, 0.6)';
      filterDefs = `
        <filter id="zenGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      `;
      filterAttr = 'filter="url(#zenGlow)"';
    } else if (chosenStyle === 'patria_heritage') {
      titleFont = "'Cinzel', 'Playfair Display', serif";
      titleSize = 56;
      titleWeight = 800;
      titleLetterSpacing = '2.5px';
      titleColor = '#FFF7ED';
      badgeBorder = 'rgba(185, 28, 28, 0.75)';
      dividerColor = 'rgba(185, 28, 28, 0.85)';
      filterDefs = `
        <filter id="heritageShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#1A0000" flood-opacity="0.9"/>
        </filter>
      `;
      filterAttr = 'filter="url(#heritageShadow)"';
    }

    // Configuración de Paleta Cromática y Acentos
    let brushStops = `
      <stop offset="0%" stop-color="#DC2626" stop-opacity="0.90"/>
      <stop offset="50%" stop-color="#EA580C" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0.85"/>
    `;

    if (activePalette === 'patria_chilena') {
      titleColor = '#FFFDF5';
      badgeBorder = 'rgba(185, 28, 28, 0.80)';
      dividerColor = 'rgba(185, 28, 28, 0.90)';
      brushStops = `
        <stop offset="0%" stop-color="#B91C1C" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#991B1B" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#1E293B" stop-opacity="0.92"/>
      `;
    } else if (activePalette === 'tierra_bosque') {
      titleColor = '#F1F5F9';
      badgeBorder = 'rgba(34, 197, 94, 0.65)';
      dividerColor = 'rgba(34, 197, 94, 0.85)';
      brushStops = `
        <stop offset="0%" stop-color="#14532D" stop-opacity="0.92"/>
        <stop offset="60%" stop-color="#166534" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#78350F" stop-opacity="0.88"/>
      `;
    } else if (activePalette === 'fuego_quincho') {
      titleColor = '#FFFBEB';
      badgeBorder = 'rgba(234, 88, 12, 0.75)';
      dividerColor = 'rgba(234, 88, 12, 0.85)';
      brushStops = `
        <stop offset="0%" stop-color="#EA580C" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#D97706" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#1C1917" stop-opacity="0.90"/>
      `;
    } else if (activeTreatment === 'gold_foil') {
      titleColor = 'url(#goldFoilGrad)';
      badgeBorder = 'rgba(212, 175, 55, 0.65)';
      dividerColor = 'rgba(212, 175, 55, 0.85)';
    } else if (activeTreatment === 'timber_burn') {
      titleColor = 'url(#timberGrad)';
      badgeBorder = 'rgba(217, 119, 6, 0.65)';
      dividerColor = 'rgba(217, 119, 6, 0.75)';
    }

    // Trazo de apoyo gráfico según tratamiento
    let brushStrokeSvg = '';
    if (activeTreatment === 'brush_stroke') {
      brushStrokeSvg = `
        <!-- Trazo gestual orgánico de autor (Dynamic Brush Ribbon) -->
        <path d="M -180 18 C -100 10, 60 22, 180 12 C 150 28, 30 32, -160 30 Z" fill="url(#brushGrad)" opacity="0.9" filter="url(#subtleGlow)"/>
      `;
    }

    // Composición Dual-Weight para titulares de marca (ej: "18 EN PAREJA")
    const words = safeHeadline.trim().split(/\s+/);
    let headlineSvgContent = '';
    if (words.length > 1 && /^\d+$/.test(words[0])) {
      const numPart = words[0];
      const restPart = words.slice(1).join(' ').toUpperCase();
      const numColor = activePalette === 'patria_chilena' ? '#B91C1C' : (activeTreatment === 'gold_foil' ? 'url(#goldFoilGrad)' : '#FFF');
      headlineSvgContent = `
        <tspan font-size="${Math.round(titleSize * 1.3)}" font-weight="900" fill="${numColor}">${numPart} </tspan>
        <tspan font-size="${Math.round(titleSize * 0.88)}" font-weight="600" letter-spacing="4px" fill="${titleColor}">${restPart}</tspan>
      `;
    } else {
      headlineSvgContent = `<tspan>${safeHeadline.toUpperCase()}</tspan>`;
    }

    // 3. Crear overlay SVG vectorial de alta jerarquía visual (estilo revista Kinfolk / Canvas Design)
    const svgOverlay = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.75"/>
            <stop offset="60%" stop-color="#000000" stop-opacity="0.20"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="30%" stop-color="#050B0A" stop-opacity="0.55"/>
            <stop offset="65%" stop-color="#050B0A" stop-opacity="0.88"/>
            <stop offset="100%" stop-color="#020504" stop-opacity="0.98"/>
          </linearGradient>
          <linearGradient id="goldFoilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F7E08B"/>
            <stop offset="25%" stop-color="#D4AF37"/>
            <stop offset="50%" stop-color="#FFF8D6"/>
            <stop offset="75%" stop-color="#AA771C"/>
            <stop offset="100%" stop-color="#E5C158"/>
          </linearGradient>
          <linearGradient id="brushGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            ${brushStops}
          </linearGradient>
          <linearGradient id="timberGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FEF3C7"/>
            <stop offset="55%" stop-color="#F59E0B"/>
            <stop offset="100%" stop-color="#92400E"/>
          </linearGradient>
          <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
          </filter>
          ${filterDefs}
        </defs>

        <!-- Sombra superior para el badge -->
        <rect x="0" y="0" width="${width}" height="200" fill="url(#topVignette)"/>

        <!-- Sombra inferior profunda para jerarquía de texto -->
        <rect x="0" y="${height - 480}" width="${width}" height="480" fill="url(#bottomVignette)"/>

        <!-- Marco fino interior (Margen elegante de imprenta) -->
        <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="6" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>

        <!-- Badge Superior Sobrio -->
        <g transform="translate(${width / 2}, 80)">
          <rect x="-195" y="-17" width="390" height="34" rx="17" fill="rgba(15, 23, 42, 0.70)" stroke="${badgeBorder}" stroke-width="1.2"/>
          <text x="0" y="5" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="12" font-weight="700" fill="#E2E8F0" text-anchor="middle" letter-spacing="3">
            ${safeBadge.toUpperCase()}
          </text>
        </g>

        <!-- Titular Principal Hero con máxima jerarquía visual y acabados de marca -->
        <g transform="translate(${width / 2}, ${height - 250})" ${filterAttr}>
          ${brushStrokeSvg}
          <text x="0" y="0" font-family="${titleFont}" font-size="${titleSize}" font-weight="${titleWeight}" fill="${titleColor}" text-anchor="middle" letter-spacing="${titleLetterSpacing}">
            ${headlineSvgContent}
          </text>
        </g>

        <!-- Línea divisoria minimalista -->
        <line x1="${width / 2 - 60}" y1="${height - 200}" x2="${width / 2 + 60}" y2="${height - 200}" stroke="${dividerColor}" stroke-width="1.5"/>

        <!-- Subtítulo editorial con respiro visual (1 sola línea limpia) -->
        <g transform="translate(${width / 2}, ${height - 150})">
          <text x="0" y="0" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="22" font-weight="400" fill="#E2E8F0" text-anchor="middle" letter-spacing="1.2">
            ${safeSubline}
          </text>
        </g>

        <!-- Pie de flyer: Ubicación & WhatsApp Reservas -->
        <g transform="translate(${width / 2}, ${height - 85})">
          <text x="0" y="0" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="14" font-weight="600" fill="#94A3B8" text-anchor="middle" letter-spacing="2">
            ALGARROBO, CHILE • RESERVAS WHATSAPP: +56 9 7900 4253
          </text>
        </g>
      </svg>
    `;

    const svgBuffer = Buffer.from(svgOverlay);
    const baseName = path.basename(inputImagePath, path.extname(inputImagePath));
    const outputFilename = `campina_flyer_${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    const outputPath = path.join(this.processedDir, outputFilename);

    await sharp(basePhotoBuffer)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .jpeg({ quality: 95 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`,
      width,
      height
    };
  }
}

module.exports = new ImageService();
