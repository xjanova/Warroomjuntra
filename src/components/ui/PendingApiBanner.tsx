'use client';

import { useSettings, isPaired } from '@/lib/stores/settings';

/**
 * Inline banner shown on pages whose data endpoint hasn't been built on the
 * thaiprompt admin API yet. Keeps the UI scaffolded for design review while
 * being honest with operators about what's real vs mock.
 *
 * Props:
 *   - endpoint: the endpoint path we're waiting for (e.g. "/sms/transactions")
 *   - rationale: short Thai explanation of what the page does once it's wired
 */
export function PendingApiBanner({
  endpoint,
  rationale,
}: {
  endpoint: string;
  rationale: string;
}) {
  const paired = useSettings((s) => isPaired(s));

  return (
    <div className="px-3 py-2 border-b border-line bg-warn/5 shrink-0 flex items-center gap-3 text-xs">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-warn/40 bg-warn/10 text-warn text-[9px] tracking-widest uppercase font-semibold mono">
        <span className="w-1 h-1 rounded-full bg-warn" />
        PREVIEW
      </span>
      <div className="flex-1 leading-relaxed">
        <span className="text-fg">หน้านี้ยังเป็น mock</span>{' '}
        <span className="text-mute">— รอ endpoint </span>
        <code className="mono text-fg">{endpoint}</code>
        <span className="text-mute"> บนฝั่ง thaiprompt admin API. </span>
        <span className="text-mute">{rationale}</span>
      </div>
      {!paired && (
        <span className="text-2xs text-mute mono whitespace-nowrap">
          (ยังไม่ได้เชื่อมต่อ)
        </span>
      )}
    </div>
  );
}
