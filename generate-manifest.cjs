const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getFiles(path.join(dir, file), fileList);
    } else if (file.endsWith('.png') || file.endsWith('.gif')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const publicDir = path.join(__dirname, 'public');
const files = getFiles(publicDir);

const manifest = {};
for (const file of files) {
  // convert backslash to slash
  let relativePath = file.substring(publicDir.length).replace(/\\/g, '/');
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }
  manifest[relativePath] = true;
}

fs.writeFileSync(path.join(__dirname, 'src/game/manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Manifest generated.');
