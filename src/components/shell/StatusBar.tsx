'use client';

import { useWarroom } from '@/lib/stores/warroom';
import { Kbd } from '@/components/ui/Kbd';

export function StatusBar() {
  const { frozen, focusMode, muted, refreshInterval } = useWarroom();
  return (
    <footer className="h-6 flex items-center px-3 gap-3 text-2xs text-mute mono border-t border-line bg-panel2/60 shrink-0">
      <span>
        <span className="dot dot-ok mr-1.5" />
        env: <span className="text-fg">production</span>
      </span>
      <span>node: <span className="text-fg">srv-01</span></span>
      <span>queue lag: <span className="text-ok">12ms</span></span>
      <span>ai chain: <span className="text-fg">gemini-pro → groq-llama → qwen-72b</span></span>
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
