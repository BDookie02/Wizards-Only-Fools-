import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'public');
const sourceSpritePattern = /['"](\/sprites\/[a-zA-Z0-9_\-\/\.]+\.(png|gif|jpe?g|webp))['"]/g;
const manifestSpritePattern = /^\/sprites\/[a-zA-Z0-9_\-\/\.]+\.(png|gif|jpe?g|webp)$/;

function walkDir(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath, extensions));
    } else if (extensions.some((extension) => file.endsWith(extension))) {
      results.push(filePath);
    }
  });
  return results;
}

function getPublicAssetPath(spritePath) {
  return path.join(publicDir, spritePath.replace(/^\/+/, ''));
}

function findSpriteManifestPaths(value, sourceFile, collector) {
  if (typeof value === 'string') {
    if (manifestSpritePattern.test(value)) {
      collector.push({ file: sourceFile, spritePath: value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => findSpriteManifestPaths(item, sourceFile, collector));
    return;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => findSpriteManifestPaths(item, sourceFile, collector));
  }
}

const srcFiles = walkDir(path.join(repoRoot, 'src'), ['.tsx', '.ts', '.js', '.jsx']);
const manifestFiles = walkDir(publicDir, ['manifest.json']);
const missingFiles = [];

srcFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Look for strings starting with /sprites/
  let match;
  while ((match = sourceSpritePattern.exec(content)) !== null) {
    const spritePath = match[1];
    // skip dynamic templates like /sprites/misc/idle_${frame}.png
    if (spritePath.includes('$')) continue;
    
    // Also skip things that are dynamic strings that happen to look static
    // (though regex already requires exact quotes)
    
    const fullPath = getPublicAssetPath(spritePath);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push({ file, missing: spritePath });
    }
  }
});

manifestFiles.forEach(file => {
  const manifestReferences = [];
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    findSpriteManifestPaths(manifest, file, manifestReferences);
  } catch (error) {
    missingFiles.push({ file, missing: `invalid JSON manifest (${error.message})` });
    return;
  }

  manifestReferences.forEach(({ file: sourceFile, spritePath }) => {
    if (!fs.existsSync(getPublicAssetPath(spritePath))) {
      missingFiles.push({ file: sourceFile, missing: spritePath });
    }
  });
});

if (missingFiles.length > 0) {
  console.error('ERROR: Missing sprites found in codebase!');
  missingFiles.forEach(m => {
    console.error(`File: ${m.file} | Missing: ${m.missing}`);
  });
  process.exit(1);
} else {
  console.log('Sprite verification passed. Static references and sprite manifests exist.');
}
