'use client';

import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { SYSTEM } from '@/lib/mock/warroom';
import { useAdminData, fetchAiDashboard } from '@/lib/api';
import { aiDashboardToServices } from '@/lib/adapters/system';

export function SystemStatus() {
  const { data, source, isLoading, error, lastFetchedAt } = useAdminData({
    key: 'system-ai-dashboard',
    fetcher: async () => aiDashboardToServices(await fetchAiDashboard()),
    mock: SYSTEM,
  });

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-ok" />
          <span className="t-h">สถานะระบบ · SYSTEM</span>
          <DataSourceBadge source={source} isLoading={isLoading} error={error} />
        </div>
        <span className="text-2xs text-mute mono">
          {lastFetchedAt ? `อัปเดต ${timeAgo(lastFetchedAt)}` : 'รอข้อมูล'}
        </span>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0 text-xs">
        {data.map((s) => (
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
        {data.length === 0 && (
          <div className="p-6 text-center text-2xs text-mute">ไม่มีบริการที่ตรวจวัด</div>
        )}
      </div>
    </section>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}
