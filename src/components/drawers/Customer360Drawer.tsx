'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWarroom } from '@/lib/stores/warroom';
import { adminWebUrl } from '@/lib/stores/settings';
import { useUserDetail } from '@/lib/api';
import { fetchUserReadings } from '@/lib/api';
import { DrawerShell } from './DrawerShell';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { userToCustomerCard } from '@/lib/adapters/customers';

const SENTIMENT_NEUTRAL = 'o'.repeat(30);

export function Customer360Drawer() {
  const { customerDrawerId, closeCustomerDrawer, pushToast } = useWarroom();
  const router = useRouter();
  // customerDrawerId is the numeric user id when set from /customers cards.
  // Pass it through useUserDetail which only fetches when non-null.
  const numericId = customerDrawerId && /^\d+$/.test(customerDrawerId) ? Number(customerDrawerId) : null;
  const detail = useUserDetail(numericId);

  const card = useMemo(() => {
    if (detail.data) return userToCustomerCard(detail.data);
    return null;
  }, [detail.data]);

  // 🧹 (2026-06-04) Neutral placeholder when there's no live user yet — no demo
  //   customer. Real data fills in once useUserDetail resolves.
  const display = card ?? {
    id: 0,
    name: '—',
    psid: '—',
    channel: 'FB' as const,
    rarity: 'COMMON' as const,
    level: 0,
    exp: 0,
    vip: false,
    problem: false,
    ltv: 0,
    credits: 0,
    readings: 0,
    sentiment: SENTIMENT_NEUTRAL,
  };

  const isLive = !!card;
  const sentimentSeries = SENTIMENT_NEUTRAL;

  // ── Live recent readings for this user ──
  const [readings, setReadings] = useState<Array<{
    id: number;
    title: string;
    when: string;
    tone: 'mystic' | 'info';
  }>>([]);
  useEffect(() => {
    let cancelled = false;
    if (!numericId) {
      setReadings([]);
      return;
    }
    fetchUserReadings(numericId, { per_page: 10 })
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.data ?? []).map((r) => {
          const isCeltic = (r.response_type ?? '').toLowerCase().includes('celtic');
          const firstQ = Array.isArray(r.questions) && r.questions.length ? r.questions[0] : 'คำถามทั่วไป';
          const title = (isCeltic ? 'Celtic Cross' : (r.is_paid ? 'ดูดวงพรีเมียม' : 'ดูดวงทั่วไป')) +
            ' — "' + (firstQ.length > 40 ? firstQ.slice(0, 38) + '…' : firstQ) + '"';
          return {
            id: r.id,
            title,
            when: r.created_at ? new Date(r.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—',
            tone: isCeltic ? ('mystic' as const) : ('info' as const),
          };
        });
        setReadings(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setReadings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  // ── Real actions ────────────────────────────────────────────────────────────
  // Jump to the live chat workspace. FB customers deep-link straight to their
  // thread via psid; LINE / unknown fall back to the chat list.
  const messageCustomer = () => {
    if (display.channel !== 'LINE' && display.psid) {
      router.push(`/chat?thread=fb-${encodeURIComponent(display.psid)}`);
    } else {
      router.push('/chat');
    }
    closeCustomerDrawer();
  };

  // Flag / account management + credit top-up have no warroom-scoped endpoint —
  // they live in the admin web. Deep-link there (same pattern as /payment).
  const flagCustomer = () => {
    if (!numericId) {
      pushToast({ kind: 'warn', title: 'ติดป้ายลูกค้า (ตัวอย่าง)', body: 'เชื่อมต่อ API ก่อนเพื่อจัดการจริง' });
      return;
    }
    window.open(adminWebUrl('/users/' + numericId), '_blank', 'noopener');
    pushToast({ kind: 'info', title: 'เปิดแอดมินเพื่อจัดการลูกค้า', body: display.name });
  };

  const addCredit = () => {
    if (!numericId) {
      pushToast({ kind: 'warn', title: 'เติมเครดิต (ตัวอย่าง)', body: 'เชื่อมต่อ API ก่อนเพื่อเติมจริง' });
      return;
    }
    window.open(adminWebUrl('/wallets?credit_user=' + numericId), '_blank', 'noopener');
  };

  return (
    <DrawerShell open={!!customerDrawerId} onClose={closeCustomerDrawer}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <button onClick={closeCustomerDrawer} className="btn btn-ghost h-7 w-7 justify-center">
          ←
        </button>
        <span className="t-h">CUSTOMER 360</span>
        {numericId && (
          <DataSourceBadge source={detail.source} isLoading={detail.isLoading} error={detail.error} />
        )}
        <div className="flex-1" />
        <button className="btn" onClick={messageCustomer}>💬 ส่งข้อความ</button>
        <button className="btn" onClick={flagCustomer} title="จัดการ/ติดป้ายลูกค้าในแอดมินเว็บ">⚠ ติดป้ายลูกค้าปัญหา</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {numericId && detail.isLoading && !card ? (
          <div className="p-6 text-center text-sm text-mute">กำลังโหลดข้อมูลลูกค้า…</div>
        ) : numericId && detail.error && !card ? (
          <div className="p-6 text-center text-sm text-crit">โหลดไม่สำเร็จ — {detail.error}</div>
        ) : (
          <>
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
                      <span className="text-lg font-semibold text-fg">{display.name}</span>
                      <Pill tone="mystic">{display.rarity}</Pill>
                      {display.vip && <Pill tone="warn">VIP</Pill>}
                      {display.problem && <Pill tone="crit">ลูกค้าปัญหา</Pill>}
                    </div>
                    <div className="text-2xs text-dim mono mt-1">
                      {display.channel === 'LINE' ? 'LINE ' : 'PSID '}{display.psid}
                      {detail.data?.created_at ? ` · เข้าร่วม ${formatDate(detail.data.created_at)}` : ''}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-2xs">
                      <span className="text-mystic">
                        LV <span className="mono text-base font-bold">{display.level}</span>
                      </span>
                      <div className="flex-1 h-1.5 bg-panel2 rounded">
                        <div className="h-full bg-gradient-to-r from-mystic to-info rounded" style={{ width: `${display.exp}%` }} />
                      </div>
                      <span className="text-dim mono">{display.exp}%</span>
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
                    <div className="flex justify-between"><span className="text-dim">เครดิตคงเหลือ</span><span className="mono text-info">{display.credits}</span></div>
                    <div className="flex justify-between"><span className="text-dim">มูลค่ารวม (LTV)</span><span className="mono text-ok">฿{display.ltv.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-dim">จำนวนดูดวง</span><span className="mono text-fg">{display.readings}</span></div>
                    {detail.data?.rank?.name && (
                      <div className="flex justify-between"><span className="text-dim">ระดับ</span><span className="mono text-mystic">{detail.data.rank.name}</span></div>
                    )}
                    {detail.data?.referral_code && (
                      <div className="flex justify-between"><span className="text-dim">รหัสแนะนำ</span><span className="mono text-info">{detail.data.referral_code}</span></div>
                    )}
                    {detail.data?.email && (
                      <div className="flex justify-between"><span className="text-dim">email</span><span className="mono text-fg truncate">{detail.data.email}</span></div>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      <button className="btn btn-ok flex-1 justify-center" onClick={addCredit} title="เติมเครดิตในแอดมินเว็บ">
                        + เครดิต
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                <span className="t-h">SENTIMENT 30 วัน</span>
                {isLive && <span className="text-2xs text-mute">(สังเคราะห์ — รอ endpoint)</span>}
              </div>
              <div className="p-3 flex items-center gap-1 h-12">
                {sentimentSeries.split('').map((s, i) => (
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
              <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                <span className="t-h">ประวัติดูดวง · ล่าสุด</span>
                {isLive && readings.length === 0 && (
                  <span className="text-2xs text-mute">(ไม่มีประวัติ)</span>
                )}
              </div>
              <div className="divide-y divide-lined text-xs">
                {readings.length > 0 ? (
                  readings.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                      <span className={`dot dot-${r.tone}`} />
                      <span className="flex-1 text-fg">{r.title}</span>
                      <span className="mono text-2xs text-mute">{r.when}</span>
                    </div>
                  ))
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DrawerShell>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('th-TH');
  } catch {
    return iso;
  }
}
