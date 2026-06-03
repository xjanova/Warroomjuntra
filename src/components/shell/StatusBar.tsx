'use client';

import { useWarroom } from '@/lib/stores/warroom';
import { useSettings } from '@/lib/stores/settings';
import { useAdminData, fetchFortuneWorkersQueue, type FortuneWorkersQueue } from '@/lib/api';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const { frozen, focusMode, muted, refreshInterval, setSettingsOpen } = useWarroom();
  const conn = useSettings((s) => s.connection);

  // Live worker telemetry. Shares the 'fortune-workers-queue' cache slot with
  // the /chat + /workers pages (coalesced), polled gently so the footer stays
  // honest about queue depth, latency, and which AI providers are actually live.
  const q = useAdminData<FortuneWorkersQueue | null>({
    key: 'fortune-workers-queue',
    fetcher: () => fetchFortuneWorkersQueue(),
    mock: null,
    intervalOverride: 15,
  });
  const queue = q.data?.queue;
  const lagMs = q.data?.latency?.avg_ms ?? null;
  const aiChain =
    q.data?.provider_split && q.data.provider_split.length > 0
      ? q.data.provider_split.slice(0, 3).map((p) => p.provider).join(' → ')
      : null;

  const connTone =
    conn.status === 'paired'
      ? 'ok'
      : conn.status === 'testing'
      ? 'info'
      : conn.status === 'error'
      ? 'crit'
      : 'mute';

  const connLabel =
    conn.status === 'paired'
      ? `paired · ${hostOf(conn.baseUrl)}${conn.user ? ` · ${conn.user.name}` : ''}`
      : conn.status === 'testing'
      ? 'testing…'
      : conn.status === 'error'
      ? 'offline'
      : 'not paired';

  return (
    <footer className="h-6 flex items-center px-3 gap-3 text-2xs text-mute mono border-t border-line bg-panel2/60 shrink-0">
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-1.5 hover:text-fg transition"
        title="คลิกเพื่อตั้งค่าการเชื่อมต่อ"
      >
        <span className={cn('dot', `dot-${connTone}`)} />
        api: <span className={cn('text-fg', conn.status === 'error' && 'text-crit')}>{connLabel}</span>
      </button>
      <span>คิว: <span className="text-fg">{queue ? `${queue.in_flight} รัน · ${queue.pending_paid + queue.pending_unpaid} รอ` : '—'}</span></span>
      <span>หน่วง: <span className={cn(lagMs != null && lagMs > 1500 ? 'text-warn' : 'text-ok')}>{lagMs != null ? `${Math.round(lagMs)}ms` : '—'}</span></span>
      <span className="hidden md:inline">ai chain: <span className="text-fg">{aiChain ?? '—'}</span></span>
      <div className="flex-1" />
      <span className="text-mute">รีเฟรชทุก {refreshInterval} วิ</span>
      {frozen ? <span className="text-warn">· แช่แข็ง</span> : null}
      {focusMode ? <span className="text-info">· โฟกัส</span> : null}
      {muted ? <span className="text-warn">· ปิดเสียง</span> : null}
      <span className="text-ghost">·</span>
      <span>
        <Kbd>?</Kbd> ปุ่มลัด
      </span>
    </footer>
  );
}

function hostOf(url: string): string {
  if (!url) return '—';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
