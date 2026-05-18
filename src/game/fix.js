import fs from 'fs';
let content = fs.readFileSync('src/game/Projectiles.tsx', 'utf8');
let lines = content.split(/\r?\n/);
lines.splice(889, 1); // remove line 890 (array index 889)
fs.writeFileSync('src/game/Projectiles.tsx', lines.join('\n'));
