'use client';

import { useWarroom } from '@/lib/stores/warroom';
import { DrawerShell } from './DrawerShell';
import { Switch } from '@/components/ui/Switch';
import { useState } from 'react';

export function SettingsDrawer() {
  const { settingsOpen, setSettingsOpen } = useWarroom();
  const [layout, setLayout] = useState<'3col' | '2col' | 'compact'>('3col');
  const [soundCrit, setSoundCrit] = useState(true);
  const [desktopNotif, setDesktopNotif] = useState(true);
  const [mood5Notif, setMood5Notif] = useState(false);

  return (
    <DrawerShell open={settingsOpen} onClose={() => setSettingsOpen(false)} width={480}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <button onClick={() => setSettingsOpen(false)} className="btn btn-ghost h-7 w-7 justify-center">
          ←
        </button>
        <span className="t-h">ตั้งค่า WAR ROOM</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <section>
          <div className="t-h mb-2">เกณฑ์ SLA (นาที)</div>
          <div className="space-y-2">
            {[
              ['คำทำนายค้าง', 5],
              ['Celtic Cross', 30],
              ['ยอดโอนไม่ตรง', 10],
              ['เคสอ่อนไหว (mood ≥ 4)', 3],
            ].map(([label, defaultVal]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className="flex-1 text-fg">{label as string}</span>
                <input type="number" defaultValue={defaultVal as number} className="w-20 px-2 py-1 text-xs mono" />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="t-h mb-2">กฎแจ้งเตือน</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Switch checked={soundCrit} onChange={setSoundCrit} />
              <span className="text-fg">เด้งเสียงเมื่อเคสวิกฤต</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={desktopNotif} onChange={setDesktopNotif} />
              <span className="text-fg">Desktop notification</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={mood5Notif} onChange={setMood5Notif} />
              <span className="text-fg">แจ้งเตือนเคส mood 5 ทันที</span>
            </label>
          </div>
        </section>

        <section>
          <div className="t-h mb-2">เสียงแจ้งเตือน</div>
          <select className="w-full px-2 py-1.5 text-xs">
            <option>Bridge — สั้น สุภาพ</option>
            <option>Submarine — ดัง กระชับ</option>
            <option>Cathedral — หรูหรา</option>
          </select>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-dim">ระดับเสียง</span>
            <input type="range" min={0} max={100} defaultValue={60} className="flex-1" />
            <span className="mono text-fg">60%</span>
          </div>
        </section>

        <section>
          <div className="t-h mb-2">เลย์เอาต์</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: '3col', label: '3 คอลัมน์' },
              { k: '2col', label: '2 คอลัมน์' },
              { k: 'compact', label: 'คอมแพ็ค' },
            ].map((opt) => (
              <button
                key={opt.k}
                onClick={() => setLayout(opt.k as typeof layout)}
                className={
                  layout === opt.k
                    ? 'aspect-video rounded border border-info bg-info/10 grid place-items-center text-xs text-info'
                    : 'aspect-video rounded border border-line bg-panel2 grid place-items-center text-xs text-mute'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="t-h mb-2">Shift handover</div>
          <div className="bg-panel2 border border-line rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="dot dot-ok" />
              <span className="text-fg">กะปัจจุบัน: 14:00 — 22:00</span>
            </div>
            <div className="text-2xs text-mute">รับช่วงต่อจาก แอน (07:00) · ส่งต่อให้ นัท เวลา 22:00</div>
            <button className="btn btn-primary w-full justify-center mt-1">บันทึกข้อความส่งกะ</button>
          </div>
        </section>
      </div>
    </DrawerShell>
  );
}
