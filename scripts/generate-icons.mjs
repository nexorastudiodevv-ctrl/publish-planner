import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outputDir = path.join(root, 'public', 'icons');
await fs.mkdir(outputDir, { recursive: true });

const fontPath = path.join(root, 'scripts', 'assets', 'Amiri-Bold.ttf');
const font = await fs.readFile(fontPath);
const fontData = font.toString('base64');

function svg(size, maskable = false) {
  const padding = maskable ? size * 0.16 : size * 0.1;
  const ring = size * 0.34;
  const center = size / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <style>
      @font-face { font-family: 'Amiri'; src: url('data:font/truetype;base64,${fontData}') format('truetype'); }
    </style>
  </defs>
  <rect width="${size}" height="${size}" rx="${maskable ? size * 0.22 : size * 0.18}" fill="#286650"/>
  <circle cx="${center}" cy="${center}" r="${ring}" fill="#fffefa"/>
  <circle cx="${center}" cy="${center}" r="${ring * 0.78}" fill="none" stroke="#286650" stroke-width="${size * 0.035}"/>
  <line x1="${center}" y1="${center}" x2="${center}" y2="${center - ring * 0.52}" stroke="#286650" stroke-width="${size * 0.045}" stroke-linecap="round"/>
  <line x1="${center}" y1="${center}" x2="${center + ring * 0.38}" y2="${center + ring * 0.18}" stroke="#c38b3b" stroke-width="${size * 0.045}" stroke-linecap="round"/>
  <text x="${center}" y="${size - padding}" text-anchor="middle" direction="rtl"
    font-family="Amiri" font-size="${size * 0.16}" font-weight="700" fill="#fffefa">م</text>
</svg>`;
}

await sharp(Buffer.from(svg(192))).png().toFile(path.join(outputDir, 'icon-192.png'));
await sharp(Buffer.from(svg(512))).png().toFile(path.join(outputDir, 'icon-512.png'));
await sharp(Buffer.from(svg(512, true))).png().toFile(path.join(outputDir, 'icon-maskable-512.png'));

console.log('Generated PWA icons in public/icons');
