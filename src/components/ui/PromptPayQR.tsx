'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildPromptPayPayload } from '@/lib/payment/promptpay';

/**
 * Renders a PromptPay QR code as an SVG. The payload is built client-side so
 * the operator can copy the raw string for debugging if a bank rejects it.
 */
export function PromptPayQR({
  target,
  amount,
  size = 160,
}: {
  target: string;
  amount?: number;
  size?: number;
}) {
  const [svg, setSvg] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const p = buildPromptPayPayload({ target, amount });
      setPayload(p);
      QRCode.toString(p, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        width: size,
      })
        .then((s) => {
          if (!cancelled) setSvg(s);
        })
        .catch((e) => {
          if (!cancelled) setErr(String(e));
        });
    } catch (e) {
      setErr(String(e));
    }
    return () => {
      cancelled = true;
    };
  }, [target, amount, size]);

  if (err) {
    return (
      <div className="text-2xs text-crit p-2 text-center" role="alert">
        QR generation failed: {err}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {svg ? (
        <div
          className="bg-white rounded p-2"
          style={{ width: size + 16, height: size + 16 }}
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label={`PromptPay QR · target ${target}${amount ? ` · amount ${amount.toFixed(2)} THB` : ''}`}
        />
      ) : (
        <div
          className="bg-white rounded grid place-items-center text-2xs text-fg-ghost"
          style={{ width: size + 16, height: size + 16 }}
        >
          กำลังสร้าง QR...
        </div>
      )}
      {payload && (
        <button
          type="button"
          className="text-2xs text-mute mono hover:text-info"
          onClick={() => {
            void navigator.clipboard.writeText(payload);
          }}
          title="คัดลอก EMV payload"
        >
          {amount != null ? `฿${amount.toFixed(2)}` : 'any amount'} · คลิกคัดลอก payload
        </button>
      )}
    </div>
  );
}
