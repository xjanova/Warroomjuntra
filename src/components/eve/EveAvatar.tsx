'use client';

import type { CSSProperties } from 'react';
import { useEve } from '@/lib/stores/eve';

/**
 * Reusable Eve avatar — renders the stage (ring + sparkles + portrait + face overlay)
 * at any size via CSS transform: scale. Reads mood + face geometry from the eve store
 * so multiple instances stay in sync (floating widget ↔ dedicated chat page).
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
  const { mood, eyeY, eyeLX, eyeRX, mouthX, mouthY } = useEve();

  const faceVars: CSSProperties = {
    ['--eye-y' as string]: `${eyeY}%`,
    ['--eyeL-x' as string]: `${eyeLX}%`,
    ['--eyeR-x' as string]: `${eyeRX}%`,
    ['--mouth-x' as string]: `${mouthX}%`,
    ['--mouth-y' as string]: `${mouthY}%`,
  };

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
              {/* Three masked copies of eve.svg stacked at the same position.
                  Each mask shows only one anatomical band (head/torso/lower)
                  with feathered edges that overlap so seams blend. Per-layer
                  animations give the impression of a layered rig without
                  actually splitting the source artwork.

                  Browser fetches /assets/eve.svg ONCE (HTTP cache) — the three
                  <img> tags share the cached response. Plain <img> (not
                  next/image) because next/image was injecting width/height
                  that fought with the absolute CSS sizing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-lower"
                src="/assets/eve.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-torso"
                src="/assets/eve.svg"
                alt=""
                aria-hidden
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="eve-layer eve-layer-head"
                src="/assets/eve.svg"
                alt="Eve"
                draggable={false}
              />
              <div className="eve-face" style={faceVars}>
                <div className="eve-eyes-pan">
                  <span className="eve-eye l" />
                  <span className="eve-eye r" />
                </div>
                <div className="eve-mouth">
                  <svg viewBox="0 0 22 14">
                    <path d="M 2 3 Q 11 6 20 3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
