// Render Eve pill (44px) and launcher (56px) at 8x for inspection.
// Tests two approaches:
//   1. img absolute-positioned with width/height 300%, shifted to show face
//   2. background-image on the round container with carefully sized/positioned bg
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');
const OUT = path.join(__dirname, 'eve-pill.png');

(async () => {
  const svg = fs.readFileSync(SRC);

  // Render the SVG large (1600x1600), then crop the face area for the pill avatar.
  // SVG face: center at (50%, 25%) of the 1:1 viewBox.
  // We want the face to fill ~80% of a circular avatar.
  const BIG = 1600;
  const buf = await sharp(svg, { density: 800 }).resize(BIG, BIG, { fit: 'contain' }).png().toBuffer();

  // Face crop window: 32% width × 32% height, centered on (50%, 25%)
  const CW = Math.round(BIG * 0.32);
  const CH = Math.round(BIG * 0.32);
  const CX = Math.round(BIG * 0.5 - CW / 2);
  const CY = Math.round(BIG * 0.25 - CH / 2);
  const cropped = await sharp(buf).extract({ left: CX, top: Math.max(0, CY), width: CW, height: CH }).png().toBuffer();

  // Composite onto three circles: pill 44px → render at 8x = 352px, launcher 56px → 448px
  const pillR = 352;
  const launcherR = 448;

  // Mask for pill (circle)
  const pillMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pillR}" height="${pillR}">
      <defs>
        <radialGradient id="g" cx="50%" cy="35%">
          <stop offset="0%" stop-color="#2a1d4d"/>
          <stop offset="75%" stop-color="#0d1320"/>
        </radialGradient>
      </defs>
      <circle cx="${pillR/2}" cy="${pillR/2}" r="${pillR/2}" fill="url(#g)"/>
    </svg>`,
  );
  const launcherMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${launcherR}" height="${launcherR}">
      <defs>
        <radialGradient id="g" cx="50%" cy="35%">
          <stop offset="0%" stop-color="#2a1d4d"/>
          <stop offset="70%" stop-color="#0d1320"/>
        </radialGradient>
      </defs>
      <circle cx="${launcherR/2}" cy="${launcherR/2}" r="${launcherR/2}" fill="url(#g)"/>
    </svg>`,
  );

  // Pill: face fills circle
  const pillFace = await sharp(cropped).resize(pillR, pillR, { fit: 'cover' }).png().toBuffer();
  const pill = await sharp(pillMask)
    .composite([
      { input: pillFace, top: 0, left: 0, blend: 'over' },
      // re-apply circular mask
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${pillR}" height="${pillR}">
            <mask id="m"><circle cx="${pillR/2}" cy="${pillR/2}" r="${pillR/2}" fill="white"/></mask>
            <rect width="${pillR}" height="${pillR}" fill="black" mask="url(#m)" opacity="0"/>
          </svg>`,
        ),
        top: 0, left: 0,
      },
    ])
    .png()
    .toBuffer();

  const launcherFace = await sharp(cropped).resize(launcherR, launcherR, { fit: 'cover' }).png().toBuffer();
  const launcher = await sharp(launcherMask)
    .composite([{ input: launcherFace, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Side-by-side preview
  const TOTAL_W = pillR + launcherR + 80;
  const TOTAL_H = Math.max(pillR, launcherR) + 80;
  const canvas = await sharp({
    create: { width: TOTAL_W, height: TOTAL_H, channels: 4, background: { r: 10, g: 14, b: 23, alpha: 1 } },
  })
    .composite([
      { input: pill, top: 40, left: 40 },
      { input: launcher, top: 40, left: 40 + pillR + 40 },
    ])
    .png()
    .toFile(OUT);

  console.log('Wrote', OUT);
})();
