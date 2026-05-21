import type { ReactNode } from 'react';

export function PageStub({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-3 py-2 border-b border-line bg-panel2/40 shrink-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-md grid place-items-center bg-info/15 border border-info/30 text-info">
          {icon ?? <span className="font-rune text-base">⚜</span>}
        </div>
        <div>
          <div className="t-h">{title}</div>
          {subtitle && <div className="text-2xs text-mute mt-0.5">{subtitle}</div>}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {children ?? (
          <div className="grid place-items-center h-full text-center text-sm text-mute">
            <div>
              <div className="text-4xl mb-3 opacity-50">🚧</div>
              <div className="text-fg">หน้านี้กำลังก่อสร้าง</div>
              <div className="text-2xs mt-1">UI ถูก design แล้ว — รอ port ตามคิว</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
