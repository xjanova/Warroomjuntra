import { cn } from '@/lib/utils';

export function SLATimer({
  remainingSec,
  totalSec,
  className,
}: {
  remainingSec: number;
  totalSec: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (remainingSec / totalSec) * 100));
  const tone =
    pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, '0');
  const ss = Math.floor(remainingSec % 60).toString().padStart(2, '0');

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <div className="mono text-xs" style={{ color: tone }}>
        {mm}:{ss}
      </div>
      <div className="sla-bar w-14">
        <div className="sla-fill" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}
