const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const imageService = require('./src/services/imageService');
const { db } = require('./src/database/db');

async function testImageProcessing() {
  console.log('🎨 Probando procesamiento de imagen y estampa de logotipo...');

  // 1. Crear una imagen base de prueba (1080x1080 azul degradado)
  const uploadsDir = path.join(__dirname, 'uploads');
  const baseImgPath = path.join(uploadsDir, 'sample_post.jpg');

  await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 14, g: 116, b: 144, alpha: 1 }
    }
  })
  .jpeg()
  .toFile(baseImgPath);

  // 2. Crear un logotipo PNG transparente de prueba (200x200 con círculo blanco)
  const watermarkDir = path.join(uploadsDir, 'watermarks');
  const logoPath = path.join(watermarkDir, 'sample_logo.png');

  const svgLogo = Buffer.from(`
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="#ffffff" opacity="0.9" />
      <text x="100" y="115" font-size="48" font-family="sans-serif" font-weight="bold" fill="#0b0f17" text-anchor="middle">LOGO</text>
    </svg>
  `);

  await sharp(svgLogo).png().toFile(logoPath);

  // Registrar watermark en base de datos
  db.prepare(`
    INSERT OR REPLACE INTO watermarks (id, name, filename, filepath, is_default)
    VALUES (1, 'Mi Logo Principal', 'sample_logo.png', '/uploads/watermarks/sample_logo.png', 1)
  `).run();

  // 3. Aplicar Watermark
  const result = await imageService.applyWatermark({
    inputImagePath: baseImgPath,
    watermarkPath: logoPath,
    position: 'bottom-right',
    opacity: 0.9,
    scalePercent: 20
  });

  console.log('   ✅ Watermark aplicado con éxito:', result.filename);
  console.log('   Ruta generada:', result.outputPath);
  console.log('   Existe archivo:', fs.existsSync(result.outputPath));

  // 4. Probar formato 9:16 para Story
  const storyResult = await imageService.formatForSocialMedia(baseImgPath, 'story');
  console.log('   ✅ Formato Story 9:16 generado:', storyResult.filename);
  console.log('   Existe archivo:', fs.existsSync(storyResult.outputPath));
}

testImageProcessing().catch(console.error);
