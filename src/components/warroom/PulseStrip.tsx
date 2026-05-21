import { Sparkline } from '@/components/ui/Sparkline';
import { Pill } from '@/components/ui/Pill';
import { KPIS } from '@/lib/mock/warroom';

export function PulseStrip() {
  return (
    <section className="px-3 py-2 border-b border-line bg-panel2/30 shrink-0">
      <div className="grid grid-cols-6 gap-2">
        {KPIS.map((k) => (
          <div key={k.label} className="panel px-3 py-2 relative">
            <div className="flex items-center justify-between">
              <div className="t-h">{k.label}</div>
              <Pill tone={k.tone}>
                {k.delta >= 0 ? '▲' : '▼'} {Math.abs(k.delta)}%
              </Pill>
            </div>
            <div className="flex items-end justify-between mt-1.5 gap-2">
              <div
                className="mono font-semibold text-fg"
                style={{ fontSize: '22px', lineHeight: '24px' }}
              >
                {k.value}
              </div>
              <Sparkline data={k.spark} stroke={k.color} />
            </div>
            <div className="text-2xs text-mute mt-0.5 mono">เทียบเมื่อวาน · {k.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
