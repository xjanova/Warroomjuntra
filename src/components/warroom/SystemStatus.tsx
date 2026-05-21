import { SYSTEM } from '@/lib/mock/warroom';

export function SystemStatus() {
  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-ok" />
          <span className="t-h">สถานะระบบ · SYSTEM</span>
        </div>
        <span className="text-2xs text-mute mono">uptime 17d 04h</span>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0 text-xs">
        {SYSTEM.map((s) => (
          <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 border-b border-lined">
            <span className={`dot dot-${s.status}`} />
            <span className="text-fg flex-1 truncate">{s.name}</span>
            <span
              className={`mono text-2xs ${
                s.status === 'ok' ? 'text-dim' : s.status === 'warn' ? 'text-warn' : 'text-crit'
              }`}
            >
              {s.metric}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
