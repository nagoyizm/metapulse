// Limpia videos/imágenes generados que ya no se usan. Uso: node scripts/cleanup-media.js [--apply]
require('dotenv').config();
const { initializeDatabase } = require('../src/database/db');
initializeDatabase();
const { runCleanup } = require('../src/services/mediaCleanupService');
const apply = process.argv.includes('--apply');
const r = runCleanup({ dryRun: !apply });
console.log(`Tiempo de vida: ${r.days} días. ${apply ? 'Borrados' : 'Se borrarían'}: ${r.deleted} archivos (${Math.round(r.freedBytes / 1048576)} MB). Se conservan: ${r.kept}.`);
for (const f of r.files.slice(0, 40)) console.log(`  ${f.file}  ${f.mb} MB  ${f.days} días`);
if (r.files.length > 40) console.log(`  ... y ${r.files.length - 40} más`);
if (!apply) console.log('\n(Simulación. Usa --apply para borrar.)');
