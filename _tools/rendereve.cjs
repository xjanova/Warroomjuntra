// Render eve.svg → PNG for inspection
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');
const OUT = path.join(__dirname, 'eve-render.png');

(async () => {
  const svg = fs.readFileSync(SRC);
  await sharp(svg, { density: 300 }).resize(512, 512, { fit: 'contain' }).png().toFile(OUT);
  console.log('Wrote', OUT);
})();
