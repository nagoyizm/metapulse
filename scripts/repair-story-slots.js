// Uso: node scripts/repair-story-slots.js [--apply]
const { repairScheduledStories } = require('../src/services/storySlotGuard');
const apply = process.argv.includes('--apply');
const moved = repairScheduledStories({ dryRun: !apply });
console.log(`${apply ? 'Movidas' : 'Se moverían'}: ${moved.length}`);
moved.forEach(m => console.log(`#${m.id} ${m.from} -> ${m.to}  ${m.title}`));
