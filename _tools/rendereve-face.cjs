// Render upper portion of eve.svg + overlay grid markers to find exact face positions.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');
const OUT = path.join(__dirname, 'eve-face.png');

(async () => {
  const svg = fs.readFileSync(SRC);
  // Full 800x800 render of the whole figure
  const buf = await sharp(svg, { density: 600 }).resize(800, 800, { fit: 'contain' }).png().toBuffer();
  // Crop the top 35% (head + neck)
  const cropped = await sharp(buf).extract({ left: 0, top: 0, width: 800, height: 320 }).png().toBuffer();

  // Build an SVG overlay with grid lines at 10% intervals + candidate face markers
  const W = 800;
  const H = 320;
  let lines = '';
  for (let i = 1; i < 10; i++) {
    const x = (W * i) / 10;
    const y = (H * i) / 10;
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="rgba(0,255,255,.25)" stroke-width="1"/>`;
    lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="rgba(0,255,255,.25)" stroke-width="1"/>`;
    lines += `<text x="${x + 2}" y="10" font-size="10" fill="cyan">${i * 10}%</text>`;
    lines += `<text x="2" y="${y - 2}" font-size="10" fill="cyan">${i * 10}%</text>`;
  }
  // Candidate face markers (red = old defaults, green = my guess)
  const markers = `
    <!-- OLD defaults (eye y=41% of full figure → here scaled to ~117%, off-screen) -->
    <!-- MY GUESS (within full 800px figure): -->
    <!--   eye y = 25% of 800 = 200 → relative to this cropped 320: 200 -->
    <!--   eyeL x = 42% of 800 = 336 -->
    <!--   eyeR x = 56% of 800 = 448 -->
    <!--   mouth x = 50% = 400 -->
    <!--   mouth y = 31% of 800 = 248 -->
    <circle cx="336" cy="200" r="8" fill="rgba(0,255,0,.7)" stroke="lime" stroke-width="1"/>
    <circle cx="448" cy="200" r="8" fill="rgba(0,255,0,.7)" stroke="lime" stroke-width="1"/>
    <circle cx="400" cy="248" r="6" fill="rgba(255,255,0,.7)" stroke="yellow" stroke-width="1"/>
    <text x="345" y="195" font-size="11" fill="white">L eye</text>
    <text x="457" y="195" font-size="11" fill="white">R eye</text>
    <text x="410" y="252" font-size="11" fill="white">mouth</text>
  `;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines}${markers}</svg>`;

  await sharp(cropped)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toFile(OUT);
  console.log('Wrote', OUT);
})();
