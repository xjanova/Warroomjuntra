'use client';

import { useMemo, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { ALL_CASES } from '@/lib/mock/warroom';
import { severityColor, typeMeta } from '@/lib/helpers';
import { useWarroom } from '@/lib/stores/warroom';
import { useSettings } from '@/lib/stores/settings';
import { useFortuneFeed } from '@/lib/api';
import { readingToTriageCase } from '@/lib/adapters/triage';
import { FollowupStrip } from './FollowupStrip';
import type { TriageCase } from '@/lib/mock/types';

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'ทุกประเภท' },
  { value: 'payment', label: 'ยอดโอนไม่ตรง' },
  { value: 'floating', label: 'บิลลอย' },
  { value: 'reading', label: 'คำทำนายค้าง' },
  { value: 'celtic', label: 'Celtic เกินกำหนด' },
  { value: 'sensitive', label: 'เคสอ่อนไหว' },
  { value: 'boterr', label: 'บอท error' },
  { value: 'refund', label: 'ขอคืนเงิน' },
];

export function TriageQueue() {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [aiSummaryOpen, setAiSummaryOpen] = useState(true);
  const [claimed, setClaimed] = useState<Record<string, { initial: string; color: string }>>({});

  const openCaseDrawer = useWarroom((s) => s.openCaseDrawer);
  const pushToast = useWarroom((s) => s.pushToast);
  const sla = useSettings((s) => s.sla);

  const feed = useFortuneFeed();
  const allCases = useMemo<TriageCase[]>(() => {
    if (feed.source === 'mock' || (feed.source === 'loading' && feed.data.length === 0)) {
      return ALL_CASES;
    }
    return feed.data
      .filter((r) => r.response_type === 'pending' || !r.responded_at)
      .map((r) => readingToTriageCase(r, sla));
  }, [feed.data, feed.source, sla]);
  const live = feed; // alias for header badge

  const cases = useMemo(() => {
    return allCases.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (filter && !(c.customer + c.detail).toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [filter, typeFilter, allCases]);

  const critCount = useMemo(() => allCases.filter((c) => c.severity === 'crit').length, [allCases]);
  const warnCount = useMemo(() => allCases.filter((c) => c.severity === 'warn').length, [allCases]);

  const claim = (c: TriageCase) => {
    setClaimed((s) => ({ ...s, [c.id]: { initial: 'AN', color: '#22d3ee' } }));
    pushToast({ kind: 'info', title: 'รับเคสแล้ว', body: `${c.customer} · ${typeMeta(c.type).label}` });
  };

  return (
    <section
      className={`panel focus-keep ${critCount > 0 ? 'glow-crit' : ''}`}
      style={{ gridRow: 'span 2', minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <header className="panel-h">
        <div className="title">
          <span className={`dot ${critCount > 0 ? 'dot-crit' : 'dot-warn'}`} />
          <span className="t-h">คิวเร่งด่วน · TRIAGE</span>
          <Pill tone="crit">{critCount} วิกฤต</Pill>
          <Pill tone="warn">{warnCount} เตือน</Pill>
          <Pill tone="dim">{allCases.length} ทั้งหมด</Pill>
          <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="กรอง..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs px-2 py-0.5 w-32 rounded"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-1.5 py-0.5 rounded"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button onClick={() => setAiSummaryOpen((v) => !v)} className="btn btn-ghost" title="AI สรุปคิว">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth={2}>
              <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.4L12 14.5 7.1 17.1 8 11.7 4 7.8 9.5 7z" />
            </svg>
            <span>สรุป AI</span>
          </button>
        </div>
      </header>

      <FollowupStrip />

      {aiSummaryOpen && (
        <div className="bg-mystic/10 border-b border-mystic/20 px-3 py-2 text-xs leading-relaxed shrink-0">
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-5 h-5 rounded grid place-items-center bg-mystic/20 mt-0.5">
              <span className="text-mystic text-2xs font-bold">AI</span>
            </div>
            <div className="flex-1 text-fg/90">
              <span className="text-mystic font-semibold">สรุปสถานการณ์:</span> ตอนนี้มี{' '}
              <span className="text-crit font-semibold">{critCount} เคสวิกฤต</span> เด่นสุดคือ{' '}
              <button onClick={() => openCaseDrawer('c-pay-001')} className="underline text-info hover:text-fg">
                ยอดโอน 2,500฿ ไม่ตรงบิลของคุณพิมพ์ชนก
              </button>{' '}
              ค้างมา 14 นาที,{' '}
              <button onClick={() => openCaseDrawer('c-sens-002')} className="underline text-info hover:text-fg">
                คุณวรากรขู่ขอคืนเงินใน FB
              </button>{' '}
              mood ระดับ 5, และ{' '}
              <button onClick={() => openCaseDrawer('c-celtic-003')} className="underline text-info hover:text-fg">
                Celtic Cross ของคุณธนกฤต
              </button>{' '}
              เกิน SLA 22 นาทีแล้ว แนะนำให้ <span className="text-warn">รับเคสยอดโอนก่อน</span>{' '}
              เพราะเป็นเงินสดและกำลังเสียลูกค้า
            </div>
            <button onClick={() => setAiSummaryOpen(false)} className="text-mute hover:text-fg">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="overflow-y-auto flex-1 min-h-0">
        {cases.map((c) => {
          const meta = typeMeta(c.type);
          const claim_ = claimed[c.id];
          return (
            <div
              key={c.id}
              className="relative border-b border-lined hover:bg-rowhi cursor-pointer group"
              onClick={() => openCaseDrawer(c.id)}
            >
              <div
                className="severity-stripe"
                style={{
                  background: severityColor(c.severity),
                  boxShadow: c.severity === 'crit' ? `0 0 12px ${severityColor(c.severity)}` : undefined,
                }}
              />
              <div className="pl-4 pr-3 py-2.5 flex items-center gap-3">
                <div
                  className={`shrink-0 w-7 h-7 rounded grid place-items-center ${
                    c.channel === 'LINE' ? 'bg-ok/15' : 'bg-info/15'
                  }`}
                >
                  <span className={`text-2xs font-bold mono ${c.channel === 'LINE' ? 'text-ok' : 'text-info'}`}>
                    {c.channel === 'LINE' ? 'L' : 'fb'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-fg truncate">{c.customer}</span>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                    {c.tags?.includes('vip') && <Pill tone="mystic">VIP</Pill>}
                    {c.tags?.includes('mood5') && <Pill tone="rose">😡 mood 5</Pill>}
                    {claim_ && (
                      <Pill tone="info">
                        <span
                          className="w-3 h-3 rounded-full grid place-items-center text-[8px] font-bold mono"
                          style={{ background: claim_.color, color: '#0a0e17' }}
                        >
                          {claim_.initial}
                        </span>
                        รับแล้ว
                      </Pill>
                    )}
                  </div>
                  <div className="text-2xs text-dim truncate">{c.detail}</div>
                </div>

                <div className="w-24 shrink-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-2xs text-mute">SLA</span>
                    <span
                      className="mono text-xs font-semibold"
                      style={{ color: severityColor(c.severity) }}
                    >
                      {c.slaDisplay}
                    </span>
                  </div>
                  <div className="sla-bar">
                    <div className="sla-fill" style={{ width: `${c.slaPct}%`, background: severityColor(c.severity) }} />
                  </div>
                  <div className="text-2xs text-mute mono mt-0.5">
                    {c.amount ? `฿${c.amount.toLocaleString()}` : c.meta}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {claim_ ? (
                    <button className="btn" onClick={(e) => e.stopPropagation()}>
                      เปิดแชต
                    </button>
                  ) : (
                    <button
                      className="btn btn-ok"
                      onClick={(e) => {
                        e.stopPropagation();
                        claim(c);
                      }}
                    >
                      รับเคส
                    </button>
                  )}
                  <button className="btn btn-ghost h-6 w-6 justify-center" title="พักเคส" onClick={(e) => e.stopPropagation()}>
                    ⏸
                  </button>
                  <button className="btn btn-ghost h-6 w-6 justify-center" title="ปิดเคส" onClick={(e) => e.stopPropagation()}>
                    ✓
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {cases.length === 0 && (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ok/10 border border-ok/30 mb-3">
              <span className="dot dot-ok" />
            </div>
            <div className="text-sm text-ok font-medium">ทุกอย่างปกติ</div>
            <div className="text-2xs text-mute mt-1">ไม่มีเคสค้างในคิว — ดูแชตสดต่อได้เลย</div>
          </div>
        )}
      </div>
    </section>
  );
}
