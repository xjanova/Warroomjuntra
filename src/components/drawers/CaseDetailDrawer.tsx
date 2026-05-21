'use client';

import { useState } from 'react';
import { useWarroom } from '@/lib/stores/warroom';
import { DrawerShell } from './DrawerShell';
import { Pill } from '@/components/ui/Pill';
import { ALL_CASES, CASE_TIMELINE } from '@/lib/mock/warroom';
import { severityColor, typeMeta } from '@/lib/helpers';

const TABS = ['ไทม์ไลน์', 'ข้อมูลที่เกี่ยว', 'ประวัติแอคชัน', 'โน้ต'] as const;
type Tab = (typeof TABS)[number];

export function CaseDetailDrawer() {
  const { caseDrawerId, closeCaseDrawer } = useWarroom();
  const [tab, setTab] = useState<Tab>('ไทม์ไลน์');
  const activeCase = ALL_CASES.find((c) => c.id === caseDrawerId);
  const open = !!caseDrawerId;

  if (!activeCase) {
    return <DrawerShell open={open} onClose={closeCaseDrawer}>{null}</DrawerShell>;
  }

  const meta = typeMeta(activeCase.type);
  const sev = severityColor(activeCase.severity);

  return (
    <DrawerShell open={open} onClose={closeCaseDrawer}>
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={closeCaseDrawer} className="btn btn-ghost h-7 w-7 justify-center">
            ←
          </button>
          <span className="t-h">เคส</span>
          <span className="mono text-2xs text-mute">{activeCase.id.toUpperCase()}</span>
          <div className="flex-1" />
          <button className="btn btn-ghost h-7 px-2">ESCALATE ↑</button>
          <button className="btn btn-ok h-7 px-2">ปิดเคส</button>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full grid place-items-center"
            style={{ background: `${sev}22`, border: `1px solid ${sev}66` }}
          >
            <span className="text-xl">⚠</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-fg">{activeCase.customer}</span>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            <div className="text-xs text-dim">{activeCase.detail}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-2xs">
          <div className="bg-panel2 rounded px-2 py-1.5">
            <div className="text-mute">SLA timer</div>
            <div className="mono text-sm" style={{ color: sev }}>
              {activeCase.slaDisplay}
            </div>
          </div>
          <div className="bg-panel2 rounded px-2 py-1.5">
            <div className="text-mute">ช่องทาง</div>
            <div className="text-sm text-fg">{activeCase.channel}</div>
          </div>
          <div className="bg-panel2 rounded px-2 py-1.5">
            <div className="text-mute">มูลค่า</div>
            <div className="mono text-sm text-fg">
              {activeCase.amount ? `฿${activeCase.amount.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-line bg-panel2/40 text-xs">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 border-b-2 ${
              tab === t ? 'text-fg border-info' : 'text-mute border-transparent hover:text-fg'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 'ไทม์ไลน์' && (
          <div className="space-y-3">
            {CASE_TIMELINE.map((ev, i) => (
              <div key={i} className="flex gap-3">
                <div className="relative shrink-0">
                  <div
                    className="w-7 h-7 rounded-full grid place-items-center"
                    style={{
                      background: `${severityColor(ev.tone)}22`,
                      border: `1px solid ${severityColor(ev.tone)}66`,
                    }}
                  >
                    <span className="text-xs">{ev.icon}</span>
                  </div>
                  {i < CASE_TIMELINE.length - 1 && (
                    <div className="absolute left-1/2 top-7 bottom-[-12px] w-px bg-line -translate-x-1/2" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-fg">{ev.title}</span>
                    <span className="text-2xs text-mute mono">{ev.ts}</span>
                  </div>
                  <div className="text-2xs text-dim mt-0.5">{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'ข้อมูลที่เกี่ยว' && (
          <div className="space-y-3 text-xs">
            <div className="bg-panel2 border border-line rounded p-3">
              <div className="t-h mb-2">บิลที่เกี่ยวข้อง</div>
              <dl className="space-y-1.5 mono">
                <div className="flex justify-between"><dt className="text-dim">เลขบิล</dt><dd className="text-fg">FB-2026-05-21-0142</dd></div>
                <div className="flex justify-between"><dt className="text-dim">ยอดบิล</dt><dd className="text-fg">฿2,499.00</dd></div>
                <div className="flex justify-between"><dt className="text-dim">ยอดโอน SMS</dt><dd className="text-crit">฿2,500.00</dd></div>
                <div className="flex justify-between"><dt className="text-dim">ส่วนต่าง</dt><dd className="text-warn">+฿1.00</dd></div>
                <div className="flex justify-between"><dt className="text-dim">ธนาคาร</dt><dd className="text-fg">KBANK xxx-2841</dd></div>
                <div className="flex justify-between"><dt className="text-dim">เวลาโอน</dt><dd className="text-fg">14:23:08</dd></div>
              </dl>
            </div>
            <div className="bg-panel2 border border-line rounded p-3">
              <div className="t-h mb-2">คำทำนายที่เกี่ยวข้อง</div>
              <div className="text-fg text-sm">Celtic Cross — คำถาม &quot;ความรักหลังเลิกแฟน&quot;</div>
              <div className="text-2xs text-dim mt-1">AI: qwen-72b · เวลาตอบ pending · เครดิตหัก 5</div>
            </div>
          </div>
        )}

        {tab === 'ประวัติแอคชัน' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="dot dot-info" />
              <span className="text-mute mono">14:18</span>
              <span className="text-fg">แอน — รับเคส</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dot dot-ok" />
              <span className="text-mute mono">14:21</span>
              <span className="text-fg">แอน — ปิดปากบอท</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dot dot-warn" />
              <span className="text-mute mono">14:25</span>
              <span className="text-fg">ระบบ — escalate ถึงนัท</span>
            </div>
          </div>
        )}

        {tab === 'โน้ต' && (
          <textarea
            rows={6}
            placeholder="เขียนโน้ตเคส (จะเห็นทั้งทีม)..."
            className="w-full p-3 text-xs"
          />
        )}
      </div>

      <div className="border-t border-line p-3 bg-panel2/40">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary justify-center py-2">💬 เปิดแชต</button>
          <button className="btn btn-ok justify-center py-2">✓ กู้บิล + เติมเครดิต</button>
          <button className="btn justify-center py-2">↪ มอบหมายให้คนอื่น</button>
          <button className="btn justify-center py-2">⏸ พักเคส 5 นาที</button>
        </div>
      </div>
    </DrawerShell>
  );
}
