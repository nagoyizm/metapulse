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
    marginPercent = 3
  }) {
    if (!fs.existsSync(inputImagePath)) {
      throw new Error(`La imagen base no existe: ${inputImagePath}`);
    }
    if (!fs.existsSync(watermarkPath)) {
      throw new Error(`El logotipo/marca de agua no existe: ${watermarkPath}`);
    }

    const baseMeta = await sharp(inputImagePath).metadata();
    const baseWidth = baseMeta.width;
    const baseHeight = baseMeta.height;

    // Calcular tamaño proporcional del logo
    const targetLogoWidth = Math.max(50, Math.round(baseWidth * (scalePercent / 100)));
    const margin = Math.round(baseWidth * (marginPercent / 100));

    // Redimensionar logo y aplicar opacidad si es necesario
    let logoBuffer = await sharp(watermarkPath)
      .resize({ width: targetLogoWidth, fit: 'inside' })
      .toBuffer();

    const logoMeta = await sharp(logoBuffer).metadata();
    const logoWidth = logoMeta.width;
    const logoHeight = logoMeta.height;

    // Calcular coordenadas [left, top]
    let left = margin;
    let top = margin;

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

    // Asegurar que no quede fuera de los límites
    left = Math.max(0, Math.min(left, baseWidth - logoWidth));
    top = Math.max(0, Math.min(top, baseHeight - logoHeight));

    // Generar archivo de salida único
    const outputFilename = `wm_${Date.now()}_${path.basename(inputImagePath)}`;
    const outputPath = path.join(this.processedDir, outputFilename);

    // Crear sombra suave y realista bajo el logo (estilo sticker comercial integrado)
    const compositeLayers = [];
    try {
      const shadowBuffer = await sharp(logoBuffer)
        .ensureAlpha()
        .linear(0, 0)
        .blur(Math.max(3, Math.round(targetLogoWidth * 0.025)))
        .png()
        .toBuffer();

      compositeLayers.push({
        input: shadowBuffer,
        top: Math.min(baseHeight - logoHeight, Math.round(top + Math.max(3, Math.round(targetLogoWidth * 0.02)))),
        left: Math.min(baseWidth - logoWidth, Math.round(left + Math.max(1, Math.round(targetLogoWidth * 0.01)))),
        blend: 'over'
      });
    } catch (sErr) {
      console.warn('No se pudo generar sombra de marca de agua:', sErr.message);
    }

    compositeLayers.push({
      input: logoBuffer,
      top: Math.round(top),
      left: Math.round(left),
      blend: 'over'
    });

    await sharp(inputImagePath)
      .composite(compositeLayers)
      .jpeg({ quality: 92 })
      .toFile(outputPath);

    return {
      outputPath,
      filename: outputFilename,
      relativeUrl: `/uploads/processed/${outputFilename}`
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
    headline = 'Tu escapada perfecta en la naturaleza',
    subline = 'Tinajas calientes bajo las estrellas • Quinchos privados • A minutos de la playa',
    badgeText = 'CABAÑAS LA CAMPIÑA • ALGARROBO',
    style = 'editorial'
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

    const safeHeadline = (headline || 'DESCONEXIÓN EN EL BOSQUE')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeSubline = (subline || 'Tinajas de agua caliente • Entorno natural • Algarrobo')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeBadge = (badgeText || 'CABAÑAS LA CAMPIÑA • ALGARROBO')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 2. Definir estilos tipográficos sobrios
    const isSerif = style === 'editorial' || style === 'rustic';
    const titleFont = isSerif
      ? "'Instrument Serif', 'Georgia', 'Playfair Display', 'Times New Roman', serif"
      : "'Outfit', 'Segoe UI', -apple-system, sans-serif";

    // 3. Crear overlay SVG vectorial de alta jerarquía visual (estilo revista / canvas-design)
    const svgOverlay = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.80"/>
            <stop offset="60%" stop-color="#000000" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="35%" stop-color="#050B0A" stop-opacity="0.60"/>
            <stop offset="70%" stop-color="#050B0A" stop-opacity="0.90"/>
            <stop offset="100%" stop-color="#020504" stop-opacity="0.98"/>
          </linearGradient>
          <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.7"/>
          </filter>
        </defs>

        <!-- Sombra superior para el badge -->
        <rect x="0" y="0" width="${width}" height="220" fill="url(#topVignette)"/>

        <!-- Sombra inferior profunda para jerarquía de texto -->
        <rect x="0" y="${height - 520}" width="${width}" height="520" fill="url(#bottomVignette)"/>

        <!-- Marco fino interior (Margen elegante de imprenta) -->
        <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="8" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>

        <!-- Badge Superior Sobrio -->
        <g transform="translate(${width / 2}, 85)">
          <rect x="-210" y="-18" width="420" height="36" rx="18" fill="rgba(15, 23, 42, 0.65)" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1"/>
          <text x="0" y="5" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="13" font-weight="700" fill="#E2E8F0" text-anchor="middle" letter-spacing="3">
            ${safeBadge.toUpperCase()}
          </text>
        </g>

        <!-- Titular Principal con tipografía sobria y jerarquía visual -->
        <g transform="translate(${width / 2}, ${height - 290})" filter="url(#subtleGlow)">
          <text x="0" y="0" font-family="${titleFont}" font-size="54" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
            ${safeHeadline}
          </text>
        </g>

        <!-- Línea divisoria minimalista -->
        <line x1="${width / 2 - 80}" y1="${height - 235}" x2="${width / 2 + 80}" y2="${height - 235}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>

        <!-- Subtítulo o atributos de descanso -->
        <g transform="translate(${width / 2}, ${height - 180})">
          <text x="0" y="0" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="22" font-weight="400" fill="#CBD5E1" text-anchor="middle" letter-spacing="0.8">
            ${safeSubline}
          </text>
        </g>

        <!-- Pie de flyer: Ubicación & Reservas -->
        <g transform="translate(${width / 2}, ${height - 95})">
          <text x="0" y="0" font-family="'Outfit', 'Segoe UI', sans-serif" font-size="15" font-weight="600" fill="#94A3B8" text-anchor="middle" letter-spacing="2">
            ALGARROBO, CHILE • RESERVAS DIRECTAS POR WHATSAPP
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
