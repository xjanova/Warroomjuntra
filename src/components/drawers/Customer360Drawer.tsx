'use client';

import { useWarroom } from '@/lib/stores/warroom';
import { DrawerShell } from './DrawerShell';
import { Pill } from '@/components/ui/Pill';

const SENTIMENT_30D = 'oooo+ooo-oo+ooo--o+o-oo++oooo-';

export function Customer360Drawer() {
  const { customerDrawerId, closeCustomerDrawer } = useWarroom();
  return (
    <DrawerShell open={!!customerDrawerId} onClose={closeCustomerDrawer}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <button onClick={closeCustomerDrawer} className="btn btn-ghost h-7 w-7 justify-center">
          ←
        </button>
        <span className="t-h">CUSTOMER 360</span>
        <div className="flex-1" />
        <button className="btn">💬 ส่งข้อความ</button>
        <button className="btn">⚠ ติดป้ายลูกค้าปัญหา</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          className="relative rounded-lg overflow-hidden border border-mystic/30"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(139,92,246,.18), transparent 50%), linear-gradient(135deg, #1a1330, #0d1320)',
          }}
        >
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative p-4">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-full bg-mystic/20 border-2 border-mystic/50 grid place-items-center text-2xl">
                🔮
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-fg">พิมพ์ชนก ส.</span>
                  <Pill tone="mystic">LEGENDARY</Pill>
                  <Pill tone="warn">VIP</Pill>
                </div>
                <div className="text-2xs text-dim mono mt-1">
                  PSID 1042883 · LINE U-a4d9f1 · ลูกค้าตั้งแต่ 2024-08-12
                </div>
                <div className="mt-2 flex items-center gap-3 text-2xs">
                  <span className="text-mystic">
                    LV <span className="mono text-base font-bold">28</span>
                  </span>
                  <div className="flex-1 h-1.5 bg-panel2 rounded">
                    <div className="h-full bg-gradient-to-r from-mystic to-info rounded" style={{ width: '64%' }} />
                  </div>
                  <span className="text-dim mono">EXP 1280/2000</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <svg viewBox="0 0 120 120" className="w-full">
                <g stroke="#1f2937" fill="none" strokeWidth={1}>
                  <polygon points="60,15 105,40 105,80 60,105 15,80 15,40" />
                  <polygon points="60,30 90,45 90,75 60,90 30,75 30,45" />
                  <polygon points="60,45 75,52 75,68 60,75 45,68 45,52" />
                </g>
                <polygon
                  points="60,18 102,42 95,76 60,98 22,78 18,44"
                  fill="rgba(139,92,246,.25)"
                  stroke="#8b5cf6"
                  strokeWidth={1.5}
                />
                <g fill="#9ca3af" fontSize="7" textAnchor="middle" fontFamily="JetBrains Mono">
                  <text x="60" y="10">รัก</text>
                  <text x="113" y="42">งาน</text>
                  <text x="113" y="84">เงิน</text>
                  <text x="60" y="118">สุขภาพ</text>
                  <text x="7" y="84">กรรม</text>
                  <text x="7" y="42">ดวง</text>
                </g>
              </svg>
              <div className="space-y-1.5 text-2xs">
                <div className="flex justify-between"><span className="text-dim">เครดิตคงเหลือ</span><span className="mono text-info">142</span></div>
                <div className="flex justify-between"><span className="text-dim">เครดิตที่ซื้อรวม</span><span className="mono text-fg">2,840</span></div>
                <div className="flex justify-between"><span className="text-dim">มูลค่ารวม (LTV)</span><span className="mono text-ok">฿24,599</span></div>
                <div className="flex justify-between"><span className="text-dim">จำนวนดูดวง</span><span className="mono text-fg">189</span></div>
                <div className="flex justify-between"><span className="text-dim">Celtic Cross</span><span className="mono text-mystic">12</span></div>
                <div className="flex justify-between"><span className="text-dim">ดูล่าสุด</span><span className="mono text-fg">14m ago</span></div>
                <div className="flex gap-1.5 mt-2">
                  <button className="btn btn-ok flex-1 justify-center">+ เครดิต</button>
                  <button className="btn flex-1 justify-center">รีเซ็ต</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="px-3 py-2 border-b border-line">
            <span className="t-h">SENTIMENT 30 วัน</span>
          </div>
          <div className="p-3 flex items-center gap-1 h-12">
            {SENTIMENT_30D.split('').map((s, i) => (
              <div
                key={i}
                className="flex-1 h-full rounded-sm"
                style={{
                  background:
                    s === '+'
                      ? 'rgba(16,185,129,.5)'
                      : s === '-'
                      ? 'rgba(239,68,68,.5)'
                      : 'rgba(75,85,99,.25)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="px-3 py-2 border-b border-line">
            <span className="t-h">ประวัติดูดวง · ล่าสุด</span>
          </div>
          <div className="divide-y divide-lined text-xs">
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="dot dot-mystic" />
              <span className="flex-1 text-fg">Celtic Cross — &quot;ความรักหลังเลิกแฟน&quot;</span>
              <span className="mono text-2xs text-mute">วันนี้ 14:18</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="dot dot-info" />
              <span className="flex-1 text-fg">ดูดวงเร่งด่วน — &quot;งานใหม่ที่สมัคร&quot;</span>
              <span className="mono text-2xs text-mute">เมื่อวาน</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="dot dot-info" />
              <span className="flex-1 text-fg">ไพ่ทาโรต์ 3 ใบ — &quot;การเงินไตรมาส&quot;</span>
              <span className="mono text-2xs text-mute">3 วันก่อน</span>
            </div>
          </div>
        </div>
      </div>
    </DrawerShell>
  );
}
