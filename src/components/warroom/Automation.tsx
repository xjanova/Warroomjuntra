'use client';

import { useState } from 'react';
import { BOTS } from '@/lib/mock/warroom';
import { Switch } from '@/components/ui/Switch';
import { useWarroom } from '@/lib/stores/warroom';

export function Automation() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BOTS.map((b) => [b.id, b.enabled])),
  );
  const pushToast = useWarroom((s) => s.pushToast);

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-mystic" />
          <span className="t-h">ระบบอัตโนมัติ · BOTS</span>
        </div>
        <button
          className="btn btn-crit text-2xs"
          onClick={() => {
            setEnabled(Object.fromEntries(BOTS.map((b) => [b.id, false])));
            pushToast({ kind: 'crit', title: 'หยุดบอททั้งหมดแล้ว' });
          }}
        >
          🛑 หยุดทั้งหมด
        </button>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {BOTS.map((b) => (
          <div key={b.id} className="px-3 py-2 border-b border-lined">
            <div className="flex items-center gap-2 mb-1">
              <span className={`dot dot-${b.state}`} />
              <span className="text-fg text-xs flex-1 truncate">{b.name}</span>
              <Switch
                checked={enabled[b.id]}
                onChange={(v) => setEnabled((s) => ({ ...s, [b.id]: v }))}
              />
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-mute">
                รอบถัดไป <span className="mono text-dim">{b.next}</span>
              </span>
              <span className="text-mute">
                ล่าสุด <span className={`mono ${b.state === 'ok' ? 'text-ok' : 'text-warn'}`}>{b.last}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
