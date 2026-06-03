'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BANNED,
  MOD_TABS,
  SPAM_WORDS,
  SUSPECTS,
  levelColor,
  levelLabel,
  levelTone,
  threatClass,
  type Suspect,
} from '@/lib/mock/moderation';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { Switch } from '@/components/ui/Switch';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import { useAdminData } from '@/lib/api/useAdminData';
import {
  fetchModerationSuspects,
  fetchModerationBanned,
  banUser,
  unbanUser,
  fetchModerationRules,
  updateModerationRules,
  describeError,
} from '@/lib/api';
import {
  suspectFromServer,
  bannedFromServer,
  moderationStatsFromServer,
} from '@/lib/adapters/moderation-page';

export default function ModerationPage() {
  const [tab, setTab] = useState<'list' | 'banned' | 'rules'>('list');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const pushToast = useWarroom((s) => s.pushToast);

  // ── Live moderation data ──
  const suspectsFeed = useAdminData({
    key: 'moderation-suspects',
    fetcher: () => fetchModerationSuspects({ since_hours: 24, per_page: 50 }),
    mock: null as unknown as Awaited<ReturnType<typeof fetchModerationSuspects>>,
  });
  const bannedFeed = useAdminData({
    key: 'moderation-banned',
    fetcher: () => fetchModerationBanned({ active_only: true, per_page: 50 }),
    mock: null as unknown as Awaited<ReturnType<typeof fetchModerationBanned>>,
  });

  const liveSuspects: Suspect[] = useMemo(() => {
    if (suspectsFeed.source === 'live' && suspectsFeed.data) {
      const items = (suspectsFeed.data as { data?: unknown[] }).data ?? [];
      return Array.isArray(items)
        ? items.map((it) => suspectFromServer(it as Parameters<typeof suspectFromServer>[0]))
        : [];
    }
    return SUSPECTS;
  }, [suspectsFeed.source, suspectsFeed.data]);

  const liveBanned = useMemo(() => {
    if (bannedFeed.source === 'live' && bannedFeed.data) {
      const items = (bannedFeed.data as { data?: unknown[] }).data ?? [];
      return Array.isArray(items)
        ? items.map((it) => bannedFromServer(it as Parameters<typeof bannedFromServer>[0]))
        : [];
    }
    return BANNED;
  }, [bannedFeed.source, bannedFeed.data]);

  const STATS = useMemo(() => {
    if (suspectsFeed.source === 'live') {
      const suspectsServer = ((suspectsFeed.data as { data?: unknown[] })?.data ?? []) as Parameters<typeof moderationStatsFromServer>[0]['suspects'];
      const bannedTotal = bannedFeed.source === 'live'
        ? Number((bannedFeed.data as { total?: number })?.total ?? liveBanned.length)
        : liveBanned.length;
      return moderationStatsFromServer({
        suspectsTotal: Number((suspectsFeed.data as { total?: number })?.total ?? liveSuspects.length),
        suspects: suspectsServer,
        bannedTotal,
      });
    }
    return [
      { label: 'เฝ้าระวังทั้งหมด', value: '42', sub: '+5 ใน 24 ชม.', color: '#e5e7eb', subColor: '#f59e0b', glow: false },
      { label: 'ระดับสงสัย', value: '28', sub: 'รอแอดมินรีวิว', color: '#f59e0b', subColor: '#6b7280', glow: false },
      { label: 'ใกล้แบน', value: '9', sub: 'ต้องตัดสินใจ', color: '#f43f5e', subColor: '#f43f5e', glow: false },
      { label: 'แบนแล้ว', value: '147', sub: 'ตลอดเดือนนี้', color: '#ef4444', subColor: '#6b7280', glow: true },
      { label: 'บัญชีลึกลับ (multi)', value: '12', sub: 'เปิดหลายบัญชี', color: '#8b5cf6', subColor: '#8b5cf6', glow: false },
    ];
  }, [suspectsFeed, bannedFeed, liveSuspects.length, liveBanned.length]);

  const [active, setActive] = useState<Suspect | null>(null);
  // Re-pin active when the live feed reshuffles and old `active` is gone.
  // Done in useEffect (NOT in render body) to avoid the "Cannot update a
  // component while rendering" warning.
  useEffect(() => {
    if (!active && liveSuspects.length > 0) {
      setActive(liveSuspects[0]);
      return;
    }
    if (active && !liveSuspects.find((s) => s.id === active.id)) {
      setActive(liveSuspects[0] ?? null);
    }
  }, [liveSuspects, active]);

  const filtered = useMemo(
    () =>
      liveSuspects.filter((s) => {
        if (channelFilter && s.channel !== channelFilter) return false;
        if (search && !(s.name + s.psid).toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [search, channelFilter, liveSuspects],
  );

  const isLive = suspectsFeed.source === 'live';

  // ── Auto-rules (Rules tab) — live read + write of moderation keywords ──
  const [extraKeywords, setExtraKeywords] = useState<string[]>([]);
  const [defaultKeywords, setDefaultKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  useEffect(() => {
    if (!isLive || tab !== 'rules') return;
    let cancelled = false;
    fetchModerationRules()
      .then((r) => {
        if (cancelled) return;
        setExtraKeywords(r.extra_keywords ?? []);
        setDefaultKeywords(r.default_keywords ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLive, tab]);

  const addKeyword = async () => {
    const kw = newKeyword.trim();
    if (!kw || extraKeywords.includes(kw)) return;
    const next = [...extraKeywords, kw];
    setExtraKeywords(next);
    setNewKeyword('');
    if (!isLive) return;
    try {
      await updateModerationRules(next);
      pushToast({ kind: 'ok', title: '+ เพิ่มคำ', body: kw });
    } catch (e) {
      pushToast({ kind: 'crit', title: 'เพิ่มคำล้มเหลว', body: describeError(e) });
      setExtraKeywords(extraKeywords); // revert
    }
  };

  const removeKeyword = async (kw: string) => {
    const next = extraKeywords.filter((k) => k !== kw);
    setExtraKeywords(next);
    if (!isLive) return;
    try {
      await updateModerationRules(next);
      pushToast({ kind: 'warn', title: '× ลบคำ', body: kw });
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ลบคำล้มเหลว', body: describeError(e) });
      setExtraKeywords(extraKeywords); // revert
    }
  };

  // Map a UI label → ban duration. Returns ISO string for `banned_until` or
  // null for permanent. Returns 'warn-only' when no ban should happen.
  const durationFor = (label: string): string | null | 'warn-only' | 'unban' => {
    if (label.includes('ปล่อย')) return 'unban';
    if (label.includes('เตือน')) return 'warn-only';
    if (label.includes('1 ชม')) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
    if (label.includes('24 ชม')) return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (label.includes('ถาวร')) return null;
    if (label.includes('เฝ้าระวัง')) return 'warn-only';
    return null;
  };

  const act = async (label: string) => {
    if (!active) return;
    const dur = durationFor(label);

    if (!isLive) {
      pushToast({ kind: dur === 'unban' ? 'ok' : 'crit', title: label + ' (mock)', body: active.name });
      return;
    }

    if (dur === 'warn-only') {
      // No backend "warn" endpoint — record a local audit entry so the
      // operator still has a paper trail. Soft action; user stays unbanned.
      const audit = JSON.parse(localStorage.getItem('warroom.moderation.audit') || '[]') as Array<{
        ts: string; action: string; psid: string; name: string;
      }>;
      audit.unshift({ ts: new Date().toISOString(), action: label, psid: active.psid, name: active.name });
      localStorage.setItem('warroom.moderation.audit', JSON.stringify(audit.slice(0, 200)));
      pushToast({ kind: 'warn', title: '⚠ ' + label, body: active.name });
      return;
    }

    if (dur === 'unban') {
      // Look up the ban row by psid in the current banned feed.
      const match = liveBanned.find((b) => b.psid === active.psid);
      if (!match) {
        pushToast({ kind: 'warn', title: 'ไม่พบบันทึกแบน', body: active.name + ' อาจไม่ถูกแบนอยู่แล้ว' });
        return;
      }
      try {
        await unbanUser(Number(match.id));
        pushToast({ kind: 'ok', title: '✓ ปล่อย ' + active.name, body: 'Ban #' + match.id });
        bannedFeed.refetch?.();
        suspectsFeed.refetch?.();
      } catch (e) {
        pushToast({ kind: 'crit', title: 'ปลดแบนไม่สำเร็จ', body: String((e as Error).message) });
      }
      return;
    }

    // Otherwise: real ban with duration `dur` (null = permanent, ISO = until time)
    try {
      await banUser({
        platform: active.channel === 'LINE' ? 'line' : 'facebook',
        platform_user_id: active.psid,
        display_name: active.name,
        reason: label + ' · ' + active.reasons.join(', '),
        banned_until: dur,
      });
      pushToast({ kind: 'crit', title: '🚫 ' + label, body: active.name });
      bannedFeed.refetch?.();
      suspectsFeed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'แบนไม่สำเร็จ', body: String((e as Error).message) });
    }
  };

  const handleUnban = async (id: string) => {
    if (isLive) {
      try {
        await unbanUser(Number(id));
        pushToast({ kind: 'ok', title: 'ปลดแบนแล้ว', body: `Ban #${id}` });
        bannedFeed.refetch?.();
      } catch (e) {
        pushToast({ kind: 'crit', title: 'ปลดแบนไม่สำเร็จ', body: String((e as Error).message) });
      }
    } else {
      pushToast({ kind: 'ok', title: 'ปลดแบนแล้ว (mock)', body: `Ban #${id}` });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-crit" />
        <span className="t-h text-crit">เฝ้าระวัง / แบน · MODERATION</span>
        <DataSourceBadge source={suspectsFeed.source} />
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="panel px-3 py-2"
              style={s.glow ? { boxShadow: '0 0 0 1px rgba(239,68,68,.35), 0 0 24px rgba(239,68,68,.15)' } : undefined}
            >
              <div className="t-h">{s.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-2xs mt-0.5" style={{ color: s.subColor }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {MOD_TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            className={`px-4 py-2 border-b-2 text-sm flex items-center gap-2 ${
              tab === t.k ? 'text-fg border-info' : 'text-mute border-transparent hover:text-fg'
            }`}
          >
            <span>{t.label}</span>
            <Pill tone={t.tone}>{t.count}</Pill>
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'list' && (
          <>
            <input
              type="text"
              placeholder="ค้นหาชื่อ / PSID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs px-2 py-1 w-72 mr-2"
            />
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="text-xs px-1.5 py-1">
              <option value="">ทุกช่อง</option>
              <option>FB</option>
              <option>LINE</option>
            </select>
            <button
              className="btn"
              onClick={() => {
                const rows = filtered.map((s) => ({
                  id: s.id, name: s.name, psid: s.psid, channel: s.channel,
                  level: s.level, score: s.score, reasons: s.reasons.join(';'), lastActive: s.lastActive,
                }));
                const header = ['id', 'name', 'psid', 'channel', 'level', 'score', 'reasons', 'lastActive'];
                const csv = [
                  header.join(','),
                  ...rows.map((r) => header.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(',')),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `warroom-moderation-suspects-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >
              ส่งออก
            </button>
          </>
        )}
      </div>

      {tab === 'list' && (
        <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 420px' }}>
          <section className="flex flex-col min-h-0 overflow-y-auto">
            <table className="dense">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>ลูกค้า</th>
                  <th>ช่อง</th>
                  <th>ระดับ</th>
                  <th>คะแนนภัย</th>
                  <th>เหตุที่ flag</th>
                  <th>ล่าสุด</th>
                  <th className="text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => setActive(s)} className={`cursor-pointer ${active?.id === s.id ? 'selected' : ''}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full grid place-items-center text-2xs font-bold mono"
                          style={{ background: `${levelColor(s.level)}22`, border: `1px solid ${levelColor(s.level)}66`, color: levelColor(s.level) }}
                        >
                          {s.name[0]}
                        </div>
                        <div className="leading-tight">
                          <div className="text-sm text-fg font-medium">{s.name}</div>
                          <div className="text-2xs text-mute mono">PSID {s.psid}</div>
                        </div>
                        {s.aliases > 1 && <Pill tone="mystic">+{s.aliases - 1} aliases</Pill>}
                      </div>
                    </td>
                    <td><ChannelChip channel={s.channel === 'LINE' ? 'line' : 'fb'} /></td>
                    <td><Pill tone={levelTone(s.level)}>{levelLabel(s.level)}</Pill></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded bg-line overflow-hidden">
                          <div className="h-full transition-all" style={{ width: `${s.score}%`, background: threatClass(s.score) }} />
                        </div>
                        <span className="mono text-xs" style={{ color: levelColor(s.level) }}>{s.score}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {s.reasons.map((r) => (
                          <Pill key={r} tone="crit">{r}</Pill>
                        ))}
                      </div>
                    </td>
                    <td className="mono text-2xs text-mute">{s.lastActive}</td>
                    <td onClick={(e) => e.stopPropagation()} className="text-right space-x-1">
                      <button onClick={() => { setActive(s); setTimeout(() => act('ส่งคำเตือน'), 0); }} className="btn btn-warn">⚠ เตือน</button>
                      <button onClick={() => { setActive(s); setTimeout(() => act('เงียบ 1 ชม.'), 0); }} className="btn">🔇 เงียบ 1ชม.</button>
                      <button onClick={() => { setActive(s); setTimeout(() => act('แบน 24 ชม.'), 0); }} className="btn btn-crit">🚫 แบน</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {active && (
            <aside className="border-l border-line bg-panel2/30 flex flex-col min-h-0 overflow-y-auto">
              <div className="p-4 border-b border-line">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full grid place-items-center text-lg font-bold"
                    style={{ background: `${levelColor(active.level)}22`, border: `1px solid ${levelColor(active.level)}66`, color: levelColor(active.level) }}
                  >
                    {active.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-fg">{active.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ChannelChip channel={active.channel === 'LINE' ? 'line' : 'fb'} />
                      <Pill tone={levelTone(active.level)}>{levelLabel(active.level)}</Pill>
                    </div>
                    <div className="text-2xs text-mute mono mt-1">PSID {active.psid}</div>
                  </div>
                </div>
                <div className="h-1.5 rounded bg-line overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${active.score}%`, background: threatClass(active.score) }} />
                </div>
                <div className="flex justify-between text-2xs text-mute mt-1 mono">
                  <span>คะแนนภัย</span>
                  <span style={{ color: levelColor(active.level) }} className="font-semibold">{active.score} / 100</span>
                </div>
              </div>

              {active.signals && (
                <div className="p-4 border-b border-line">
                  <div className="t-h mb-2">สัญญาณที่ตรวจพบ</div>
                  <div className="space-y-1.5">
                    {active.signals.map((sig) => (
                      <div key={sig.k} className="flex items-center gap-2 text-xs">
                        <span className={`dot dot-${sig.tone}`} />
                        <span className="flex-1 text-fg">{sig.label}</span>
                        <span className={`mono text-2xs text-${sig.tone}`}>{sig.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active.evidence && active.evidence.length > 0 && (
                <div className="p-4 border-b border-line">
                  <div className="t-h mb-2">หลักฐาน (ข้อความล่าสุด)</div>
                  <div className="space-y-2">
                    {active.evidence.map((m, i) => (
                      <div
                        key={i}
                        className="rounded px-2.5 py-1.5 text-xs"
                        style={{
                          background: m.severity === 'crit' ? 'rgba(239,68,68,.06)' : 'rgba(245,158,11,.06)',
                          border: m.severity === 'crit' ? '1px solid rgba(239,68,68,.18)' : '1px solid rgba(245,158,11,.2)',
                          color: m.severity === 'crit' ? '#fca5a5' : '#fbbf24',
                        }}
                      >
                        <div className="text-2xs text-mute mono mb-1">{m.ts} · {m.tag}</div>
                        <div>{m.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active.aliasList && (
                <div className="p-4 border-b border-line">
                  <div className="t-h mb-2 flex items-center gap-2">
                    <span>บัญชีอื่นที่คาดว่าใช่คนเดียวกัน</span>
                    <Pill tone="mystic">{active.aliases}</Pill>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {active.aliasList.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-panel border border-line rounded px-2 py-1.5">
                        <ChannelChip channel={a.channel === 'LINE' ? 'line' : 'fb'} />
                        <span className="flex-1 text-fg">{a.name}</span>
                        <span className="text-2xs text-mute mono">{a.match}% ตรง</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active.audit && active.audit.length > 0 && (
                <div className="p-4 border-b border-line">
                  <div className="t-h mb-2">ประวัติการกระทำ</div>
                  <div className="space-y-1.5 text-2xs">
                    {active.audit.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="dot dot-info" />
                        <span className="text-mute mono w-16">{l.ts}</span>
                        <span className="flex-1 text-fg">{l.action}</span>
                        <span className="text-mystic">{l.by}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 sticky bottom-0 bg-panel2 border-t border-line space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => act('เพิ่มเฝ้าระวัง')} className="btn">👁 เพิ่มเฝ้าระวัง</button>
                  <button onClick={() => act('ส่งคำเตือน')} className="btn btn-warn">⚠ ส่งคำเตือน</button>
                  <button onClick={() => act('เงียบ 1 ชม.')} className="btn">🔇 เงียบ 1 ชม.</button>
                  <button onClick={() => act('เงียบ 24 ชม.')} className="btn btn-warn">🔇 เงียบ 24 ชม.</button>
                  <button onClick={() => act('แบน 24 ชม.')} className="btn btn-crit">🚫 แบน 24 ชม.</button>
                  <button onClick={() => act('แบนถาวร')} className="btn btn-crit">🚫 แบนถาวร</button>
                </div>
                <button onClick={() => act('ปล่อย — ปกติ')} className="btn btn-ok w-full justify-center">
                  ✓ ปล่อย — ลูกค้าปกติ
                </button>
              </div>
            </aside>
          )}
        </main>
      )}

      {tab === 'banned' && (
        <main className="flex-1 overflow-y-auto">
          <table className="dense">
            <thead className="sticky top-0 z-10">
              <tr>
                <th>ลูกค้า</th>
                <th>ช่อง</th>
                <th>เหตุผล</th>
                <th>โดย</th>
                <th>แบนเมื่อ</th>
                <th>หมดเมื่อ</th>
                <th className="text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {liveBanned.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full grid place-items-center bg-crit/15 border border-crit/40 text-crit text-2xs font-bold">{b.name[0]}</div>
                      <div>
                        <div className="text-sm text-fg">{b.name}</div>
                        <div className="text-2xs text-mute mono">{b.psid}</div>
                      </div>
                    </div>
                  </td>
                  <td><ChannelChip channel={b.channel === 'LINE' ? 'line' : 'fb'} /></td>
                  <td className="text-xs text-fg">{b.reason}</td>
                  <td className="text-2xs text-mystic">{b.by}</td>
                  <td className="mono text-2xs text-mute">{b.bannedAt}</td>
                  <td className={`mono text-2xs ${b.permanent ? 'text-crit' : 'text-warn'}`}>
                    {b.permanent ? 'ถาวร' : b.endsAt}
                  </td>
                  <td className="text-right">
                    <button className="btn btn-ok" onClick={() => handleUnban(b.id)}>ปลดแบน</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}

      {tab === 'rules' && (
        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="text-2xs text-mute bg-panel2 border border-line rounded px-3 py-2 leading-relaxed">
              ✏️ <span className="text-fg">รายการคีย์เวิร์ด</span> แก้ไขได้จริง (บันทึกขึ้น API ทันที) — ส่วน
              <span className="text-fg"> สวิตช์เปิด/ปิดกฎ และเกณฑ์คะแนน</span> เป็นค่าฝั่งเซิร์ฟเวอร์ ปรับใน
              แอดมินเว็บ จึงแสดงเป็นแบบอ่านอย่างเดียวที่นี่
            </div>
            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-crit" />
                <span className="font-semibold text-fg">คำสแปม / คำหยาบ</span>
                <Pill tone="crit">+30 คะแนน</Pill>
                <div className="flex-1" />
                <Switch checked disabled onChange={() => {}} />
              </div>
              <div className="text-2xs text-mute mb-2">ตรวจจับคำในรายการต่อไปนี้ในข้อความลูกค้า (เพิ่มคะแนนภัยทุกครั้งที่เจอ)</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(isLive ? [...defaultKeywords, ...extraKeywords] : SPAM_WORDS).map((w) => {
                  const isExtra = isLive && extraKeywords.includes(w);
                  const isBuiltIn = isLive && defaultKeywords.includes(w);
                  return (
                    <span key={w} className="pill pill-crit" title={isBuiltIn ? 'built-in keyword (ลบไม่ได้)' : isExtra ? 'extra — กดลบได้' : ''}>
                      {w}
                      {isExtra ? (
                        <button
                          className="text-crit/60 hover:text-crit ml-1"
                          onClick={() => void removeKeyword(w)}
                          aria-label={`ลบ ${w}`}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder={isLive ? '+ เพิ่มคำใหม่ (Enter)...' : '+ เพิ่มคำใหม่ (paired only)...'}
                disabled={!isLive}
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addKeyword();
                  }
                }}
                className="text-xs px-2 py-1 w-full disabled:opacity-50"
              />
            </div>

            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-warn" />
                <span className="font-semibold text-fg">ทักซ้ำ / สแปม</span>
                <Pill tone="warn">+10 คะแนน/ครั้ง</Pill>
                <div className="flex-1" />
                <Switch checked disabled onChange={() => {}} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-2xs text-mute">ข้อความเดียวกันไม่เกิน</label>
                  <input type="number" defaultValue={3} className="w-full px-2 py-1 mt-1 mono" />
                </div>
                <div>
                  <label className="text-2xs text-mute">ใน X นาที</label>
                  <input type="number" defaultValue={5} className="w-full px-2 py-1 mt-1 mono" />
                </div>
              </div>
            </div>

            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-info" />
                <span className="font-semibold text-fg">หลายบัญชี (multi-account)</span>
                <Pill tone="info">+25 คะแนน</Pill>
                <div className="flex-1" />
                <Switch checked disabled onChange={() => {}} />
              </div>
              <div className="text-2xs text-mute">หา fingerprint ที่ตรงกัน: IP, device, ลายมือพิมพ์, รูปโปรไฟล์</div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" defaultChecked /><span className="text-fg">IP/device</span></label>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" defaultChecked /><span className="text-fg">ลายเขียน</span></label>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" /><span className="text-fg">รูปโปรไฟล์</span></label>
              </div>
            </div>

            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-warn" />
                <span className="font-semibold text-fg">อารมณ์ผันผวน (mood swing)</span>
                <Pill tone="warn">+15 คะแนน</Pill>
                <div className="flex-1" />
                <Switch checked disabled onChange={() => {}} />
              </div>
              <div className="text-2xs text-mute">sentiment เปลี่ยนจาก happy → angry ภายใน 10 ข้อความ</div>
            </div>

            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-crit" />
                <span className="font-semibold text-fg">ขู่ / ใช้กฎหมาย / รีวิว 1 ดาว</span>
                <Pill tone="crit">+40 คะแนน + escalate</Pill>
                <div className="flex-1" />
                <Switch checked disabled onChange={() => {}} />
              </div>
              <div className="text-2xs text-mute">เด้งแจ้งเตือนหัวหน้ากะทันที</div>
            </div>

            <div className="panel p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="dot dot-info" />
                <span className="font-semibold text-fg">เกณฑ์แบนอัตโนมัติ</span>
                <div className="flex-1" />
                <Switch checked={false} disabled onChange={() => {}} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-2xs text-mute">คะแนน ≥</label>
                  <input type="number" defaultValue={80} className="w-full px-2 py-1 mt-1 mono" />
                </div>
                <div>
                  <label className="text-2xs text-mute">การกระทำ</label>
                  <select className="w-full px-1 py-1 mt-1">
                    <option>แบน 24 ชม.</option>
                    <option>แบนถาวร</option>
                    <option>แจ้งแอดมิน</option>
                  </select>
                </div>
                <div>
                  <label className="text-2xs text-mute">แจ้ง</label>
                  <select className="w-full px-1 py-1 mt-1">
                    <option>หัวหน้ากะ</option>
                    <option>ทุกคน</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 bg-warn/10 border border-warn/30 rounded p-2 text-2xs text-warn">
                ⚠ ยังปิดอยู่ — เปิดเมื่อคุณมั่นใจในความแม่นยำของคะแนน
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
