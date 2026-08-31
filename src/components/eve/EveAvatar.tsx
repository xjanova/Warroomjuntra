'use client';

import { useEve } from '@/lib/stores/eve';

/**
 * Eve's avatar — the ring/sparkle stage plus the figure itself.
 *
 * 🎨 (2026-08-31) Face rewritten to the thaiprompt.online treatment.
 *
 * The old version drew a tiny CSS face (two 9×4px dots + an SVG mouth path) on
 * top of `/assets/eve.svg` — but that file is the ORIGINAL artwork, which still
 * has the illustrator's own eyes and mouth baked in. So the overlay never
 * replaced the painted face, it sat on top of it: two sets of eyes, slightly
 * out of register, which is what made the figure look off.
 *
 * thaiprompt's Eve solved this properly: the same 2048×2048 artwork with the
 * old eyes / mouth / background paths deleted (`eve-body.svg` — a clean canvas
 * of skin and hair), and a far richer face drawn on top in proportional units —
 * brows, lidded eyes with two highlights, a nose, and an expressive mouth.
 * Everything is a % of the face box, so it stays aligned at every `scale`.
 *
 * What is kept from warroom: the three-band masked rig (head bob · torso
 * breath · skirt sway) and the ring + sparkle stage. The face rides the same
 * head-bob keyframes, so it tracks the head instead of floating over it.
 *
 * Moods: idle · talking · thinking · happy come from thaiprompt; `concerned`
 * and `surprise` are warroom-only and are drawn here to match that style.
 */
export function EveAvatar({
  scale = 1,
  showRing = true,
  showSparkles = true,
  className,
}: {
  scale?: number;
  showRing?: boolean;
  showSparkles?: boolean;
  className?: string;
}) {
  // The face is fully proportional now, so the store's eyeY/eyeLX/… nudge values
  // are no longer read here — nothing in the app ever set them away from their
  // defaults, and hand-tuned pixel offsets are what the % layout replaces.
  const mood = useEve((s) => s.mood);

  // The base .eve-stage is 200x230. We wrap it so layout occupies the
  // scaled bounding box, then absolutely position + scale the actual stage
  // so transforms don't shift it relative to the wrapper.
  const BASE_W = 200;
  const BASE_H = 230;

  return (
    <div
      className={className}
      style={{
        width: BASE_W * scale,
        height: BASE_H * scale,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: BASE_W,
          height: BASE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        <div className="eve" data-mood={mood}>
          <div className="eve-stage">
            {showRing && <span className="ring" />}
            {showSparkles && (
              <>
                <span className="spark s2" />
                <span className="spark s3" />
                <span className="spark s4" />
                <span className="spark s5" />
              </>
            )}
            <div className="eve-avatar">
              {/* Three masked copies of the SAME file — the browser fetches
                  /assets/eve-body.svg once and reuses the cached response. Each
                  copy is clipped to one anatomical band with a feathered mask,
                  then animated on its own timing, which reads as a layered rig
                  without splitting the artwork. Plain <img> (not next/image):
                  next/image injects width/height that fights the absolute CSS. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-lower"
                src="/assets/eve-body.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-torso"
                src="/assets/eve-body.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-head"
                src="/assets/eve-body.svg"
                alt="Eve"
                draggable={false}
              />

              {/* Face — positioned as a % box over the head, so every feature
                  inside it stays registered at any scale. */}
              <div className="eve-face" aria-hidden>
                <span className="eve-brow l" />
                <span className="eve-brow r" />
                <span className="eve-eye l">
                  <i className="eve-hi" />
                  <i className="eve-hi2" />
                </span>
                <span className="eve-eye r">
                  <i className="eve-hi" />
                  <i className="eve-hi2" />
                </span>
                <span className="eve-nose" />
                <span className="eve-mouth">
                  <i className="eve-teeth" />
                  <i className="eve-tongue" />
                </span>
                <span className="eve-dots">●●●</span>
                <span className="eve-spark">✦</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
