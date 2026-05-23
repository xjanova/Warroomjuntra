'use client';

import { useEffect, useMemo, useState } from 'react';
import { CHAT_TEMPLATES, CHAT_THREADS, type ChatThread } from '@/lib/mock/chat-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { Switch } from '@/components/ui/Switch';
import { Kbd } from '@/components/ui/Kbd';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed, sendChatMessage, suggestChatReply, describeError } from '@/lib/api';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { readingToChatThread } from '@/lib/adapters/chat';
import { cn } from '@/lib/utils';

const SENTIMENT_30D = 'oo+oo-oo+o-oo+';

export default function ChatPage() {
  const feed = useFortuneFeed();
  const threads = useMemo<ChatThread[]>(() => {
    if (feed.source === 'live' && feed.data.length > 0) {
      return feed.data.map(readingToChatThread);
    }
    return CHAT_THREADS;
  }, [feed.data, feed.source]);

  const [filter, setFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [onlyAdmin, setOnlyAdmin] = useState(false);
  const [activeId, setActiveId] = useState<string>(threads[0]?.id ?? '');
  const [bot, setBot] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(threads.map((c) => [c.id, c.bot])),
  );
  // Reset active + bot map when the thread list changes (mock → live, or refetch).
  useEffect(() => {
    setBot(Object.fromEntries(threads.map((c) => [c.id, c.bot])));
    if (!threads.find((c) => c.id === activeId)) {
      setActiveId(threads[0]?.id ?? '');
    }
  }, [threads, activeId]);

  const [draft, setDraft] = useState('');
  const [aiSuggest, setAiSuggest] = useState('');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const pushToast = useWarroom((s) => s.pushToast);
  const paired = useSettings((s) => isPairedFn(s));

  // Active chat thread → reading id (live threads have id like "r-{id}").
  const readingIdOf = (threadId: string): number | null => {
    const m = /^r-(\d+)$/.exec(threadId);
    return m ? Number(m[1]) : null;
  };

  const filtered = useMemo(
    () =>
      threads.filter((c) => {
        if (channelFilter && c.channel !== channelFilter) return false;
        if (onlyAdmin && bot[c.id]) return false;
        if (filter && !c.name.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      }),
    [threads, filter, channelFilter, onlyAdmin, bot],
  );

  const active = threads.find((c) => c.id === activeId);

  const sendDraft = async () => {
    const v = draft.trim();
    if (!v || sending) return;
    if (!active) return;

    const rid = readingIdOf(active.id);
    if (!paired || !rid) {
      pushToast({ kind: 'ok', title: 'ส่งข้อความแล้ว (mock)', body: v.slice(0, 60) });
      setDraft('');
      return;
    }

    setSending(true);
    try {
      const res = await sendChatMessage({ reading_id: rid, text: v });
      if (res.delivered) {
        pushToast({ kind: 'ok', title: '✓ ส่งแล้ว → ' + active.name, body: v.slice(0, 60) });
        setDraft('');
        feed.refetch?.();
      } else {
        pushToast({ kind: 'warn', title: 'ส่งไม่ผ่าน platform', body: 'FB/LINE ปฏิเสธ — ลองอีกครั้ง' });
      }
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ส่งข้อความล้มเหลว', body: describeError(e) });
    } finally {
      setSending(false);
    }
  };

  const requestAiSuggestion = async () => {
    if (!active || suggesting) return;
    const rid = readingIdOf(active.id);
    const recentText = active.messages?.slice(-3).map((m) => `[${m.by}] ${m.text}`).join('\n') ?? '';

    if (!paired || !rid) {
      // Local mock suggestion (no API call).
      setAiSuggest(
        'คุณ' + active.name + ' คะ ทางทีมงานเช็คยอดเงินอยู่แล้ว ขออภัยในความล่าช้านะคะ',
      );
      return;
    }

    setSuggesting(true);
    setAiSuggest('');
    try {
      const res = await suggestChatReply({
        reading_id: rid,
        context_text: recentText || 'ลูกค้าทักมาขอตรวจสอบสถานะการชำระเงิน',
        customer_name: active.name,
      });
      setAiSuggest(res.suggestion);
    } catch (e) {
      pushToast({ kind: 'crit', title: 'AI แนะนำล้มเหลว', body: describeError(e) });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="grid h-full min-h-0" style={{ gridTemplateColumns: '280px 1fr 320px' }}>
      <aside className="border-r border-line flex flex-col bg-panel2/30 min-h-0">
        <div className="p-2 border-b border-line space-y-1.5">
          <div className="flex items-center gap-2 px-1 mb-1">
            <span className="t-h">แชต · LIVE</span>
            <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
          </div>
          <input
            type="text"
            placeholder="ค้นหาแชต..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-2 py-1.5 text-xs"
          />
          <div className="flex gap-1 text-2xs">
            <button onClick={() => setChannelFilter('')} className={cn('pill', channelFilter === '' ? 'pill-info' : 'pill-dim')}>
              ทั้งหมด
            </button>
            <button onClick={() => setChannelFilter('FB')} className={cn('pill', channelFilter === 'FB' ? 'pill-info' : 'pill-dim')}>
              fb · FB
            </button>
            <button onClick={() => setChannelFilter('LINE')} className={cn('pill', channelFilter === 'LINE' ? 'pill-ok' : 'pill-dim')}>
              L · LINE
            </button>
            <button onClick={() => setOnlyAdmin((v) => !v)} className={cn('pill', onlyAdmin ? 'pill-mystic' : 'pill-dim')}>
              มีแอดมิน
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.map((c) => {
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-lined hover:bg-rowhi',
                  isActive && 'bg-info/8 border-l-2 border-l-info',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ChannelChip channel={c.channel === 'LINE' ? 'line' : 'fb'} />
                  <span className="text-sm text-fg font-medium truncate flex-1">{c.name}</span>
                  <span className="text-2xs mono text-mute">{c.lastTs}</span>
                </div>
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  {c.vip && <Pill tone="warn">VIP</Pill>}
                  {bot[c.id] ? <Pill tone="ok">🤖</Pill> : c.takenBy && (
                    <Pill tone="info">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.takenBy.color }} />
                      {c.takenBy.initial}
                    </Pill>
                  )}
                  {c.sentiment === 'angry' && <Pill tone="rose">😡</Pill>}
                  {c.sentiment === 'happy' && <Pill tone="ok">😊</Pill>}
                  {c.unread > 0 && <Pill tone="crit">{c.unread}</Pill>}
                </div>
                <div className="text-2xs text-dim truncate">{c.last}</div>
                {c.pinReason && (
                  <div className="text-2xs text-warn mt-0.5">{c.pinReason}</div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex flex-col bg-base min-h-0">
        {active && (
          <>
            <header className="px-4 py-2 border-b border-line bg-panel2/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-mystic/20 border border-mystic/50 grid place-items-center text-lg">🔮</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{active.name}</span>
                  <ChannelChip channel={active.channel === 'LINE' ? 'line' : 'fb'} />
                  {active.vip && <Pill tone="warn">VIP</Pill>}
                  <Pill tone="mystic">{active.rarity}</Pill>
                </div>
                <div className="text-2xs text-mute mono mt-0.5">
                  PSID {active.psid} · เปิดสนทนา {active.openedAt}
                  {active.takenByName && (
                    <>
                      {' · เทคโอเวอร์โดย '}
                      <span className="text-info">{active.takenByName}</span> ({active.takenAt})
                    </>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-2xs text-dim">
                บอท
                <Switch checked={bot[active.id]} onChange={(v) => setBot((s) => ({ ...s, [active.id]: v }))} />
              </label>
              {!bot[active.id] && (
                <button
                  onClick={() => {
                    setBot((s) => ({ ...s, [active.id]: true }));
                    pushToast({ kind: 'ok', title: 'คืนงานให้บอทแล้ว', body: active.name });
                  }}
                  className="btn btn-ok"
                >
                  ↪ คืนงานให้บอท
                </button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0 scanline">
              {active.messages.map((m) => {
                if (m.role === 'system') {
                  return (
                    <div key={m.id} className="text-center">
                      <span className="pill pill-dim border-dashed">{m.text}</span>
                    </div>
                  );
                }
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex gap-2 max-w-[80%]">
                      <div className="bg-rowhi border border-line rounded-lg rounded-tl-sm px-3 py-2 text-sm">
                        <div>{m.text}</div>
                        <div className="text-2xs text-mute mono mt-1">{m.ts}</div>
                      </div>
                    </div>
                  );
                }
                if (m.role === 'bot') {
                  return (
                    <div key={m.id} className="flex gap-2 max-w-[80%] ml-auto flex-row-reverse">
                      <div className="bg-info/8 border border-info/20 rounded-lg rounded-tr-sm px-3 py-2 text-sm text-cyan-200">
                        <div className="text-2xs text-info/80 mb-0.5 font-semibold flex items-center gap-1">
                          <span>🤖 บอท</span>
                          {m.ai && <span className="text-mute font-normal">· {m.ai}</span>}
                        </div>
                        <div>{m.text}</div>
                        <div className="text-2xs text-info/50 mono mt-1 text-right">{m.ts}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="flex gap-2 max-w-[80%] ml-auto flex-row-reverse">
                    <div className="bg-mystic/12 border border-mystic/30 rounded-lg rounded-tr-sm px-3 py-2 text-sm text-violet-200">
                      <div className="text-2xs text-mystic/90 mb-0.5 font-semibold">👤 {m.by}</div>
                      <div>{m.text}</div>
                      <div className="text-2xs text-mystic/60 mono mt-1 text-right">{m.ts}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {aiSuggest && (
              <div className="mx-4 mb-2 border border-mystic/30 rounded bg-mystic/8 p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded grid place-items-center bg-mystic/20 text-mystic text-2xs font-bold">
                    AI
                  </span>
                  <div className="flex-1">
                    <div className="text-2xs text-mystic font-semibold mb-1">AI แนะนำคำตอบ</div>
                    <div className="text-sm text-fg/90">{aiSuggest}</div>
                  </div>
                  <button
                    onClick={() => {
                      setDraft(aiSuggest);
                      setAiSuggest('');
                    }}
                    className="btn btn-mystic"
                  >
                    ใช้
                  </button>
                  <button onClick={() => setAiSuggest('')} className="btn btn-ghost">
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 py-2 border-t border-line bg-panel2/40 flex items-center gap-1.5 overflow-x-auto">
              <span className="t-h shrink-0">เทมเพลต</span>
              {CHAT_TEMPLATES.map((t) => (
                <button key={t} onClick={() => setDraft(t)} className="btn shrink-0 text-2xs">
                  {t}
                </button>
              ))}
            </div>

            <div className="border-t border-line p-3 bg-panel2/60">
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <button className="btn btn-ghost h-7 w-7 justify-center" title="แนบรูป">📎</button>
                  <button className="btn btn-ghost h-7 w-7 justify-center" title="ส่ง QR">▦</button>
                  <button className="btn btn-ghost h-7 w-7 justify-center" title="ส่งเสียง">🎤</button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="พิมพ์ข้อความ... (Cmd+Enter ส่ง)"
                  className="flex-1 p-2 text-sm resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      sendDraft();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => void sendDraft()}
                    disabled={!draft.trim() || sending}
                    className="btn btn-primary px-3 disabled:opacity-40"
                  >
                    {sending ? 'กำลังส่ง...' : <>ส่ง <Kbd>⌘↵</Kbd></>}
                  </button>
                  <button
                    onClick={() => void requestAiSuggestion()}
                    disabled={suggesting}
                    className="btn btn-mystic px-3 disabled:opacity-40"
                  >
                    {suggesting ? '⏳ คิด...' : 'AI แนะนำ'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {active && (
        <aside className="border-l border-line flex flex-col bg-panel2/30 min-h-0 overflow-y-auto">
          <div className="p-4 border-b border-line">
            <div
              className="relative rounded-lg overflow-hidden border border-mystic/30"
              style={{
                background:
                  'radial-gradient(circle at top right, rgba(139,92,246,.18), transparent 50%), linear-gradient(135deg, #1a1330, #0d1320)',
              }}
            >
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-12 h-12 rounded-full bg-mystic/20 border border-mystic/50 grid place-items-center text-xl">🔮</div>
                  <div className="flex-1">
                    <div className="font-semibold text-fg text-sm">{active.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Pill tone="mystic">{active.rarity}</Pill>
                      {active.vip && <Pill tone="warn">VIP</Pill>}
                    </div>
                    <div className="text-2xs mono text-dim mt-1">
                      LV <span className="text-mystic font-bold">{active.level}</span> · EXP {active.exp}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 border-b border-line">
            <div className="t-h mb-2">เครดิต & การเงิน</div>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">เครดิตคงเหลือ</div>
                <div className="mono text-info text-base font-semibold">{active.credits}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">LTV รวม</div>
                <div className="mono text-ok text-base font-semibold">฿{active.ltv.toLocaleString()}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">ดูดวงทั้งหมด</div>
                <div className="mono text-fg text-base font-semibold">{active.readings}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">ค้างจ่าย</div>
                <div className="mono text-warn text-base font-semibold">฿{active.due}</div>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <button className="btn btn-ok flex-1 justify-center">+ เครดิต</button>
              <button className="btn flex-1 justify-center">รีเซ็ต</button>
            </div>
          </div>

          <div className="p-3 border-b border-line">
            <div className="t-h mb-2">SENTIMENT 14 วัน</div>
            <div className="flex items-center gap-0.5 h-8">
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

          <div className="p-3 border-b border-line">
            <div className="t-h mb-2">PERSONA NOTES</div>
            <ul className="text-xs space-y-1 text-fg/90">
              <li className="flex gap-1.5"><span className="text-info">›</span>ชอบดูดวงเรื่องความรัก (78%)</li>
              <li className="flex gap-1.5"><span className="text-info">›</span>ชอบ Celtic Cross มากกว่าไพ่ 3 ใบ</li>
              <li className="flex gap-1.5"><span className="text-info">›</span>โอนผ่าน KBANK ทุกครั้ง</li>
              <li className="flex gap-1.5"><span className="text-warn">›</span>ใจร้อน — ตอบช้าจะทักซ้ำใน 5 นาที</li>
            </ul>
          </div>

          <div className="p-3">
            <div className="t-h mb-2">ดูดวงล่าสุด</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="dot dot-mystic" />
                <span className="flex-1 text-fg truncate">Celtic — &quot;ความรักหลังเลิกแฟน&quot;</span>
                <span className="text-2xs text-mute mono">14m</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="dot dot-info" />
                <span className="flex-1 text-fg truncate">3 ใบ — &quot;งานที่สมัคร&quot;</span>
                <span className="text-2xs text-mute mono">1d</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="dot dot-info" />
                <span className="flex-1 text-fg truncate">รายเดือน</span>
                <span className="text-2xs text-mute mono">3d</span>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
