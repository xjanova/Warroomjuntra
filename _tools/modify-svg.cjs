// Modify eve.svg: add skin-colored ellipses to cover the artwork's eyes and mouth,
// so only our CSS overlay features show.
//
// Strategy: append <ellipse> elements just before </svg> — they paint on top
// of all existing paths, effectively erasing the eye/mouth area with skin tone.
//
// Then render the result for visual verification before saving.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'assets', 'eve.svg');
const OUT_PREVIEW = path.join(__dirname, 'eve-clean-preview.png');
const OUT_SVG = path.join(__dirname, 'eve-clean.svg');

// Sampled skin tone (from sample-skin.cjs)
const SKIN = 'rgb(252,217,207)';

// SVG viewBox is 2048 × 2048. Face center at (50%, 25%) = (1024, 512).
// Eye centers at (43%, 26%) = (880, 532) and (57%, 26%) = (1168, 532).
// Mouth center at (50%, 31%) = (1024, 635).
//
// Coverage ellipses (rx/ry chosen to fully cover the painted features
// without spilling onto eyebrows above or cheek blush below):
const SHAPES = [
  // Eyes — wide enough to swallow eyeliner + iris + highlight
  { cx: 880,  cy: 532, rx: 100, ry: 40, label: 'L eye' },
  { cx: 1168, cy: 532, rx: 100, ry: 40, label: 'R eye' },
  // Mouth — covers the small smile curve and lip line
  { cx: 1024, cy: 635, rx: 50,  ry: 20, label: 'mouth' },
];

(async () => {
  let svg = fs.readFileSync(SRC, 'utf8');

  // Build the cover ellipses
  const cover = SHAPES.map(
    (s) =>
      `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${SKIN}"/><!-- erase ${s.label} -->`,
  ).join('\n');

  // Inject just before </svg>
  const modified = svg.replace(/<\/svg>\s*$/, `${cover}\n</svg>`);

  fs.writeFileSync(OUT_SVG, modified);
  console.log('Wrote modified SVG →', OUT_SVG);

  // Render the modified SVG with the new CSS eye positions overlaid (closer together)
  const W = 800;
  const H = 800;
  const buf = await sharp(Buffer.from(modified), { density: 600 }).resize(W, H, { fit: 'contain' }).png().toBuffer();

  // Crop top 40%
  const cropped = await sharp(buf).extract({ left: 0, top: 0, width: W, height: 320 }).png().toBuffer();

  // Overlay the NEW CSS eye positions (45%/55%, closer together) + mouth (50%)
  // Eye dimensions in 200px avatar (9×4) → in 800px render (36×16)
  const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="320">
  <!-- New eye positions: 45% L, 55% R, y=26% (so y in 800 = 208) -->
  <ellipse cx="${0.45 * W}" cy="208" rx="18" ry="8" fill="#2b1810"/>
  <ellipse cx="${0.55 * W}" cy="208" rx="18" ry="8" fill="#2b1810"/>
  <!-- Eye highlights -->
  <ellipse cx="${0.45 * W - 3}" cy="206" rx="6" ry="3" fill="white" opacity="0.85"/>
  <ellipse cx="${0.55 * W - 3}" cy="206" rx="6" ry="3" fill="white" opacity="0.85"/>
  <!-- Mouth at 50%, 31% (y=248) — idle smile path scaled to 36×12 -->
  <g transform="translate(${0.50 * W - 18}, 242)">
    <svg width="36" height="12" viewBox="0 0 22 14" preserveAspectRatio="none">
      <path d="M 2 3 Q 11 6 20 3" fill="none" stroke="#3d1f2a" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  </g>
</svg>
  `;

  await sharp(cropped)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toFile(OUT_PREVIEW);

  console.log('Wrote preview →', OUT_PREVIEW);
})();
