// Sample skin tone color from the face area of the rendered eve.svg.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');

(async () => {
  const svg = fs.readFileSync(SRC);
  // Render at high density
  const W = 2048;
  const { data, info } = await sharp(svg, { density: 600 })
    .resize(W, W, { fit: 'contain' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Sample several points on the face:
  // - cheek (left): x=42%, y=28% — just below left eye
  // - cheek (right): x=58%, y=28% — just below right eye
  // - forehead: x=50%, y=20%
  // - between eyes: x=50%, y=25%
  // - below mouth: x=50%, y=33%
  const samples = [
    { name: 'cheek-L', x: 0.42, y: 0.28 },
    { name: 'cheek-R', x: 0.58, y: 0.28 },
    { name: 'forehead', x: 0.50, y: 0.20 },
    { name: 'between-eyes', x: 0.50, y: 0.24 },
    { name: 'below-mouth', x: 0.50, y: 0.33 },
    { name: 'left-of-mouth', x: 0.46, y: 0.31 },
    { name: 'right-of-mouth', x: 0.54, y: 0.31 },
  ];

  const ch = info.channels; // 3 or 4
  console.log(`Image ${info.width}x${info.height}, channels=${ch}`);
  for (const s of samples) {
    const px = Math.round(s.x * info.width);
    const py = Math.round(s.y * info.height);
    const idx = (py * info.width + px) * ch;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const a = ch === 4 ? data[idx + 3] : 255;
    console.log(`  ${s.name.padEnd(15)} (${px},${py}) → rgba(${r},${g},${b},${a}) #${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
  }
})();
