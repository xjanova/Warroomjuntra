// Render Eve at 200x200 (actual avatar size) + overlay the face elements
// at the NEW positions to verify visually.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');
const OUT = path.join(__dirname, 'eve-verify.png');

const W = 400; // 2x of 200 for legibility
const H = 400;

// New CSS variable values
const EYE_Y = 0.26;
const EYE_L_X = 0.45;
const EYE_R_X = 0.55;
const EYE_W = 9 * 2; // double-up since render is 2x
const EYE_H = 4 * 2;
const MOUTH_X = 0.50;
const MOUTH_Y = 0.31;
const MOUTH_W = 18 * 2;
const MOUTH_H = 6 * 2;

(async () => {
  const svg = fs.readFileSync(SRC);
  const buf = await sharp(svg, { density: 600 }).resize(W, H, { fit: 'contain' }).png().toBuffer();

  const eyeLX = EYE_L_X * W;
  const eyeRX = EYE_R_X * W;
  const eyeY  = EYE_Y * H;
  const mouthX = MOUTH_X * W;
  const mouthY = MOUTH_Y * H;

  // Build SVG overlay with dark ovals (matching the React component's .eve-eye style)
  const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Left eye -->
  <ellipse cx="${eyeLX}" cy="${eyeY}" rx="${EYE_W/2}" ry="${EYE_H/2}" fill="#2b1810" stroke="rgba(139,92,246,.5)" stroke-width="0.5"/>
  <!-- White highlight (matches .eve-eye::after) -->
  <ellipse cx="${eyeLX - 1}" cy="${eyeY - EYE_H * 0.2}" rx="${EYE_W * 0.18}" ry="${EYE_H * 0.18}" fill="white" opacity="0.85"/>

  <!-- Right eye -->
  <ellipse cx="${eyeRX}" cy="${eyeY}" rx="${EYE_W/2}" ry="${EYE_H/2}" fill="#2b1810" stroke="rgba(139,92,246,.5)" stroke-width="0.5"/>
  <ellipse cx="${eyeRX - 1}" cy="${eyeY - EYE_H * 0.2}" rx="${EYE_W * 0.18}" ry="${EYE_H * 0.18}" fill="white" opacity="0.85"/>

  <!-- Mouth (idle smile, scaled from path "M 2 3 Q 11 6 20 3" within 22x14 viewBox) -->
  <g transform="translate(${mouthX - MOUTH_W/2}, ${mouthY - MOUTH_H/2})">
    <svg width="${MOUTH_W}" height="${MOUTH_H}" viewBox="0 0 22 14" preserveAspectRatio="none">
      <path d="M 2 3 Q 11 6 20 3" fill="none" stroke="#3d1f2a" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  </g>

  <!-- Crosshair markers at the exact center points -->
  <circle cx="${eyeLX}" cy="${eyeY}" r="1.5" fill="lime"/>
  <circle cx="${eyeRX}" cy="${eyeY}" r="1.5" fill="lime"/>
  <circle cx="${mouthX}" cy="${mouthY}" r="1.5" fill="yellow"/>
</svg>
  `;

  await sharp(buf)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toFile(OUT);

  console.log('Wrote', OUT);
  console.log(`Eye L: (${eyeLX}, ${eyeY})`);
  console.log(`Eye R: (${eyeRX}, ${eyeY})`);
  console.log(`Mouth: (${mouthX}, ${mouthY})`);
})();
