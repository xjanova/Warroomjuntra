'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWarroom } from '@/lib/stores/warroom';
import { useSettings, adminWebUrl } from '@/lib/stores/settings';
import { useReadingDetail, markReadingPaid, describeError } from '@/lib/api';
import { DrawerShell } from './DrawerShell';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { ALL_CASES, CASE_TIMELINE } from '@/lib/mock/warroom';
import { readingToTriageCase } from '@/lib/adapters/triage';
import { severityColor, typeMeta } from '@/lib/helpers';
import type { TriageCase } from '@/lib/mock/types';

const TABS = ['ไทม์ไลน์', 'ข้อมูลที่เกี่ยว', 'ประวัติแอคชัน', 'โน้ต'] as const;
type Tab = (typeof TABS)[number];

export function CaseDetailDrawer() {
  const { caseDrawerId, closeCaseDrawer, hideCase, pushToast } = useWarroom();
  const sla = useSettings((s) => s.sla);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ไทม์ไลน์');
  const [acting, setActing] = useState(false);

  // Live readings have ids like "r-{numeric}" — extract and fetch.
  // Mock cases have ids like "c-pay-001" — look up locally.
  const readingId = caseDrawerId?.startsWith('r-') ? caseDrawerId.slice(2) : null;
  const detail = useReadingDetail(readingId);

  const open = !!caseDrawerId;

  const activeCase: TriageCase | null = useMemo(() => {
    if (!caseDrawerId) return null;
    if (readingId && detail.data) {
      return readingToTriageCase(detail.data, sla);
    }
    return ALL_CASES.find((c) => c.id === caseDrawerId) ?? null;
  }, [caseDrawerId, readingId, detail.data, sla]);

  if (!activeCase) {
    return (
      <DrawerShell open={open} onClose={closeCaseDrawer}>
        <div className="p-6 text-center text-mute text-sm">
          {detail.isLoading && readingId
            ? 'กำลังโหลดข้อมูลเคส…'
            : detail.error
            ? `โหลดเคสไม่สำเร็จ — ${detail.error}`
            : 'ไม่พบเคสนี้'}
        </div>
      </DrawerShell>
    );
  }

  const meta = typeMeta(activeCase.type);
  const sev = severityColor(activeCase.severity);
  const reading = detail.data;

  // ── Real case actions ──────────────────────────────────────────────────────
  const goChat = () => {
    router.push(`/chat?thread=${encodeURIComponent(activeCase.id)}`);
    closeCaseDrawer();
  };

  // "กู้บิล" = confirm the customer actually paid → mark the reading paid.
  const recoverBill = async () => {
    if (!readingId) {
      pushToast({ kind: 'warn', title: 'กู้บิล (ตัวอย่าง)', body: 'เคสนี้ไม่มี reading จริงให้ยืนยัน' });
      return;
    }
    if (!confirm(`ยืนยันว่าชำระเงินแล้วสำหรับเคส ${activeCase.customer}?`)) return;
    if (acting) return;
    setActing(true);
    try {
      await markReadingPaid(readingId);
      pushToast({ kind: 'ok', title: 'ยืนยันชำระเงินแล้ว', body: activeCase.customer });
      detail.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ทำรายการล้มเหลว', body: describeError(e) });
    } finally {
      setActing(false);
    }
  };

  // Escalation has no backend channel — copy a shareable link the operator can
  // paste into the team chat to pull in a senior.
  const escalate = async () => {
    const link = readingId
      ? adminWebUrl('/fortune/readings/' + readingId)
      : typeof window !== 'undefined'
      ? window.location.origin
      : '';
    try {
      await navigator.clipboard.writeText(link);
      pushToast({ kind: 'info', title: 'คัดลอกลิงก์เคสแล้ว', body: 'วางในแชตทีมเพื่อส่งต่อให้หัวหน้า' });
    } catch {
      pushToast({ kind: 'warn', title: 'คัดลอกไม่สำเร็จ', body: link });
    }
  };

  const closeCase = () => {
    hideCase(activeCase.id);
    pushToast({ kind: 'ok', title: 'ปิดเคสแล้ว', body: activeCase.customer });
    closeCaseDrawer();
  };

  const snoozeCase = () => {
    hideCase(activeCase.id, 5);
    pushToast({ kind: 'info', title: 'พักเคส 5 นาที', body: activeCase.customer });
    closeCaseDrawer();
  };

  const openInAdmin = () => {
    window.open(
      readingId ? adminWebUrl('/fortune/readings/' + readingId) : adminWebUrl('/fortune/readings'),
      '_blank',
      'noopener',
    );
  };

  return (
    <DrawerShell open={open} onClose={closeCaseDrawer}>
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={closeCaseDrawer} className="btn btn-ghost h-7 w-7 justify-center">
            ←
          </button>
          <span className="t-h">เคส</span>
          <span className="mono text-2xs text-mute">{activeCase.id.toUpperCase()}</span>
          {readingId && (
            <DataSourceBadge source={detail.source} isLoading={detail.isLoading} error={detail.error} />
          )}
          <div className="flex-1" />
          <button className="btn btn-ghost h-7 px-2" onClick={escalate} title="คัดลอกลิงก์เคสเพื่อส่งต่อให้หัวหน้า">
            ⧉ ส่งต่อ
          </button>
          <button className="btn btn-ok h-7 px-2" onClick={closeCase} title="เอาเคสออกจากคิว">
            ✓ ปิดเคส
          </button>
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
          <LiveOrMockTimeline reading={reading} />
        )}

        {tab === 'ข้อมูลที่เกี่ยว' && (
          <RelatedInfo reading={reading} activeCase={activeCase} />
        )}

        {tab === 'ประวัติแอคชัน' && (
          <div className="space-y-2 text-xs">
            {reading?.responded_at ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="dot dot-info" />
                  <span className="text-mute mono">{formatTime(reading.created_at)}</span>
                  <span className="text-fg">สร้างคำถาม</span>
                </div>
                {reading.paid_at && (
                  <div className="flex items-center gap-2">
                    <span className="dot dot-ok" />
                    <span className="text-mute mono">{formatTime(reading.paid_at)}</span>
                    <span className="text-fg">ชำระเงิน · ฿{reading.amount_paid.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="dot dot-mystic" />
                  <span className="text-mute mono">{formatTime(reading.responded_at)}</span>
                  <span className="text-fg">
                    {reading.response_type === 'admin' ? 'Admin ตอบ' : `AI ตอบ · ${reading.ai?.provider ?? 'unknown'}`}
                  </span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
          <button className="btn btn-primary justify-center py-2" onClick={goChat}>
            💬 เปิดแชต
          </button>
          <button
            className="btn btn-ok justify-center py-2 disabled:opacity-40"
            onClick={recoverBill}
            disabled={acting}
          >
            {acting ? '⏳ กำลังทำ…' : '✓ กู้บิล (ยืนยันจ่าย)'}
          </button>
          <button className="btn justify-center py-2" onClick={openInAdmin}>
            🔮 เปิดในแอดมิน
          </button>
          <button className="btn justify-center py-2" onClick={snoozeCase}>
            ⏸ พักเคส 5 นาที
          </button>
        </div>
      </div>
    </DrawerShell>
  );
}

function LiveOrMockTimeline({ reading }: { reading: import('@/lib/api').FortuneReading | null | undefined }) {
  if (!reading) {
    // Mock case fallback
    return (
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
    );
  }

  // Live timeline built from FortuneReading fields
  type TimelineEvent = { ts: string; icon: string; tone: string; title: string; desc: string };
  const events: TimelineEvent[] = [];
  if (reading.created_at)
    events.push({
      ts: formatFull(reading.created_at),
      icon: '✉',
      tone: 'info',
      title: 'สร้างคำถาม',
      desc: previewQuestions(reading.questions),
    });
  if (reading.paid_at)
    events.push({
      ts: formatFull(reading.paid_at),
      icon: '💰',
      tone: 'ok',
      title: 'ชำระเงิน',
      desc: `฿${reading.amount_paid.toLocaleString()}`,
    });
  if (reading.responded_at) {
    const isAdmin = reading.response_type === 'admin';
    events.push({
      ts: formatFull(reading.responded_at),
      icon: isAdmin ? '👤' : '🤖',
      tone: 'mystic',
      title: isAdmin ? 'Admin ตอบ' : `AI ตอบ · ${reading.ai?.provider ?? 'unknown'}`,
      desc: reading.ai_response ? truncate(reading.ai_response, 200) : '(ไม่มี response text)',
    });
  } else {
    events.push({
      ts: '—',
      icon: '⌛',
      tone: 'warn',
      title: 'รอคำทำนาย',
      desc: 'ยังไม่มี response',
    });
  }

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
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
            {i < events.length - 1 && (
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
  );
}

function RelatedInfo({
  reading,
  activeCase,
}: {
  reading: import('@/lib/api').FortuneReading | null | undefined;
  activeCase: TriageCase;
}) {
  if (!reading) {
    return (
      <div className="space-y-3 text-xs">
        <div className="bg-panel2 border border-line rounded p-3">
          <div className="t-h mb-2">บิลที่เกี่ยวข้อง</div>
          <dl className="space-y-1.5 mono">
            <div className="flex justify-between"><dt className="text-dim">เลขบิล</dt><dd className="text-fg">{activeCase.id.toUpperCase()}</dd></div>
            <div className="flex justify-between"><dt className="text-dim">ยอด</dt><dd className="text-fg">฿{(activeCase.amount ?? 0).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-dim">ช่องทาง</dt><dd className="text-fg">{activeCase.channel}</dd></div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="bg-panel2 border border-line rounded p-3">
        <div className="t-h mb-2">บิล/การชำระเงิน</div>
        <dl className="space-y-1.5 mono">
          <div className="flex justify-between"><dt className="text-dim">Reading ID</dt><dd className="text-fg">{reading.id}</dd></div>
          <div className="flex justify-between"><dt className="text-dim">ประเภท</dt><dd className="text-fg">{reading.reading_type === 'deep' ? 'Celtic Cross' : reading.reading_type}</dd></div>
          <div className="flex justify-between"><dt className="text-dim">ยอด</dt><dd className="text-fg">฿{reading.amount_paid.toLocaleString()}</dd></div>
          <div className="flex justify-between"><dt className="text-dim">สถานะ</dt><dd className={reading.is_paid ? 'text-ok' : 'text-warn'}>{reading.is_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}</dd></div>
          {reading.paid_at && (
            <div className="flex justify-between"><dt className="text-dim">จ่ายเมื่อ</dt><dd className="text-fg">{formatFull(reading.paid_at)}</dd></div>
          )}
        </dl>
      </div>
      <div className="bg-panel2 border border-line rounded p-3">
        <div className="t-h mb-2">คำถาม</div>
        <div className="text-fg text-sm leading-relaxed whitespace-pre-wrap">
          {previewQuestions(reading.questions, 500)}
        </div>
      </div>
      {reading.ai_response && (
        <div className="bg-panel2 border border-line rounded p-3">
          <div className="t-h mb-2">คำตอบ {reading.response_type === 'admin' ? '(จาก Admin)' : `(จาก ${reading.ai?.provider ?? 'AI'})`}</div>
          <div className="text-fg text-sm leading-relaxed whitespace-pre-wrap">
            {reading.ai_response}
          </div>
          {reading.ai?.tokens_used != null && (
            <div className="text-2xs text-mute mono mt-2">
              tokens: {reading.ai.tokens_used.toLocaleString()}
              {reading.ai.model ? ` · model: ${reading.ai.model}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(iso?: string | null): string {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatFull(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function previewQuestions(q: import('@/lib/api').FortuneReading['questions'], max = 200): string {
  if (!q) return '(ไม่มีคำถาม)';
  const text = Array.isArray(q) ? q.join('\n') : String(q);
  return truncate(text, max);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
