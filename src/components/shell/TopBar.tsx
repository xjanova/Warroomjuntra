'use client';

import { useEffect, useState } from 'react';
import { Search, Pause, Play, VolumeX, Volume2, Focus, Maximize2, RefreshCw } from 'lucide-react';
import { useWarroom } from '@/lib/stores/warroom';
import { useSettings, isPaired } from '@/lib/stores/settings';
import { verifyConnection, refreshAll, fetchAdminsOnline, type AdminPresence } from '@/lib/api';
import { Kbd } from '@/components/ui/Kbd';
import { formatClock, formatThaiDate, cn } from '@/lib/utils';

export function TopBar() {
  const {
    clock,
    dateStr,
    frozen,
    muted,
    focusMode,
    refreshInterval,
    presence,
    setClock,
    setFrozen,
    setMuted,
    setFocusMode,
    setRefreshInterval,
    setCmdkOpen,
  } = useWarroom();
  const setPersistedRefresh = useSettings((s) => s.setRefreshInterval);
  const paired = useSettings((s) => isPaired(s));

  // tick every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(formatClock(now), formatThaiDate(now));
    };
    tick();
    if (frozen) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [setClock, frozen]);

  // Live presence — poll admins/online every 30s. Only when paired.
  const [livePresence, setLivePresence] = useState<AdminPresence[]>([]);
  useEffect(() => {
    if (!paired) {
      setLivePresence([]);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetchAdminsOnline();
        if (!cancelled) setLivePresence(res.data ?? []);
      } catch {
        if (!cancelled) setLivePresence([]);
      }
    };
    void tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [paired]);

  // When paired, only ever show REAL admins (even an empty strip while the first
  // poll lands) — never the demo team, which would misrepresent who's online.
  // The mock team is only for the unpaired design-preview state.
  const presenceRows = paired
    ? livePresence.map((u) => ({ id: String(u.id), initial: u.initials, online: u.is_online, name: u.name, role: u.role }))
    : presence;

  return (
    <header className={cn(
      'h-12 flex items-center px-3 gap-3 shrink-0 relative z-30',
      'border-b backdrop-blur-sm',
      frozen ? 'border-warn/40 bg-warn/10' : 'border-line bg-panel2/80',
    )}>
      {/* Brand */}
      <a href="/" className="flex items-center gap-2 no-underline">
        <div className="w-7 h-7 rounded-md grid place-items-center border border-gold/35"
             style={{
               background:
                 'radial-gradient(circle at 60% 40%, rgba(212,167,71,.18), transparent 60%), radial-gradient(circle at 30% 80%, rgba(139,92,246,.15), transparent 50%), #0a0e17',
               boxShadow: '0 0 10px rgba(212,167,71,.22)',
             }}>
          <span className="font-rune text-fg text-xs">⚜</span>
        </div>
        <div className="leading-tight">
          <div className="font-rune text-sm tracking-[.16em] text-fg">JUNTRA</div>
          <div className="text-[8px] tracking-[.18em] text-mute mono">WAR ROOM · OPS</div>
        </div>
      </a>

      <div className="w-px h-6 bg-line" />

      {/* Cmd+K */}
      <button
        onClick={() => setCmdkOpen(true)}
        className="flex items-center gap-2 h-7 px-2 bg-panel border border-line hover:border-info/50 rounded text-xs text-dim hover:text-fg transition w-72"
      >
        <Search size={12} />
        <span className="flex-1 text-left">ค้นหา ลูกค้า · บิล · เคส · คำสั่ง</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="flex-1" />

      {/* Live clock */}
      <div className="flex items-center gap-2 px-2 h-7 rounded border border-line bg-panel">
        <span className={cn('dot', frozen ? 'dot-warn' : 'dot-info')} />
        <span className="mono text-xs text-fg">{clock}</span>
        <span className="text-2xs text-mute mono">{dateStr}</span>
      </div>

      {/* Refresh */}
      <div className="flex items-center gap-1.5 text-2xs text-mute">
        <span>รีเฟรช</span>
        <select
          value={refreshInterval}
          onChange={(e) => {
            const v = Number(e.target.value) as 2 | 5 | 10 | 30;
            setRefreshInterval(v);
            setPersistedRefresh(v);
          }}
          className="bg-panel border border-line rounded text-xs px-1.5 py-0.5 text-fg"
        >
          <option value={2}>2 วิ</option>
          <option value={5}>5 วิ</option>
          <option value={10}>10 วิ</option>
          <option value={30}>30 วิ</option>
        </select>
      </div>

      {paired && (
        <button
          type="button"
          onClick={() => {
            // Re-verify the connection (in case token expired silently) and
            // force every mounted hook to refetch immediately.
            void verifyConnection();
            refreshAll();
          }}
          title="รีเฟรชข้อมูลทันที"
          className="btn btn-ghost"
        >
          <RefreshCw size={12} />
        </button>
      )}

      <button
        type="button"
        onClick={() => setFrozen(!frozen)}
        title={frozen ? 'เริ่มอัปเดต (Space)' : 'หยุดอัปเดต (Space)'}
        className={cn('btn', frozen ? 'btn-warn' : 'btn-ghost')}
      >
        {frozen ? <Play size={12} /> : <Pause size={12} />}
        <span>{frozen ? 'เล่นต่อ' : 'แช่แข็ง'}</span>
      </button>

      <button
        type="button"
        onClick={() => setMuted(!muted)}
        title={muted ? 'เปิดเสียง (M)' : 'ปิดเสียง (M)'}
        className={cn('btn btn-ghost', muted && 'text-warn')}
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>

      <button
        type="button"
        onClick={() => setFocusMode(!focusMode)}
        title="โหมดโฟกัส (F)"
        className={cn('btn btn-ghost', focusMode && 'text-info')}
      >
        <Focus size={12} />
      </button>

      <button
        type="button"
        onClick={() => {
          if (document.fullscreenElement) document.exitFullscreen?.();
          else document.documentElement.requestFullscreen?.();
        }}
        title="เต็มจอ"
        className="btn btn-ghost"
      >
        <Maximize2 size={12} />
      </button>

      <div className="w-px h-6 bg-line" />

      {/* Presence */}
      <div className="flex items-center -space-x-1">
        {presenceRows.map((u) => (
          <span
            key={u.id}
            className={cn(
              'relative w-6 h-6 rounded-full grid place-items-center text-2xs font-semibold border',
              u.online ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-panel text-mute',
            )}
            title={`${u.name} · ${u.role}`}
          >
            {u.initial}
            {u.online && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-ok ring-2 ring-base" />}
          </span>
        ))}
      </div>
    </header>
  );
}
