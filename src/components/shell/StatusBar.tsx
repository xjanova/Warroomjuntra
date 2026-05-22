'use client';

import { useWarroom } from '@/lib/stores/warroom';
import { useSettings } from '@/lib/stores/settings';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const { frozen, focusMode, muted, refreshInterval, setSettingsOpen } = useWarroom();
  const conn = useSettings((s) => s.connection);

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
      <span>node: <span className="text-fg">srv-01</span></span>
      <span>queue lag: <span className="text-ok">12ms</span></span>
      <span className="hidden md:inline">ai chain: <span className="text-fg">gemini-pro → groq-llama → qwen-72b</span></span>
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
