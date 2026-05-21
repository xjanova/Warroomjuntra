'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useWarroom } from '@/lib/stores/warroom';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

type Cmd = {
  id: string;
  title: string;
  hint?: string;
  keywords: string;
  action: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { cmdkOpen, setCmdkOpen, setFocusMode, setFrozen, setMuted } = useWarroom();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const commands: Cmd[] = useMemo(
    () => [
      { id: 'go-war', title: 'ไปยัง · War Room', keywords: 'home dashboard', action: () => router.push('/') },
      { id: 'go-chat', title: 'ไปยัง · แชตสด / Takeover', keywords: 'chat takeover', action: () => router.push('/chat') },
      { id: 'go-predict', title: 'ไปยัง · ทำนาย (Workbench)', keywords: 'predict ai prompt', action: () => router.push('/predict') },
      { id: 'go-bills', title: 'ไปยัง · บิล', keywords: 'bills invoice', action: () => router.push('/bills') },
      { id: 'go-payment', title: 'ไปยัง · กระทบยอดการเงิน', keywords: 'payment recon sms', action: () => router.push('/payment') },
      { id: 'go-approvals', title: 'ไปยัง · รออนุมัติ', keywords: 'approvals commission refund', action: () => router.push('/approvals') },
      { id: 'go-moderation', title: 'ไปยัง · เฝ้าระวัง', keywords: 'moderation sensitive banned', action: () => router.push('/moderation') },
      { id: 'go-bots', title: 'ไปยัง · บอท', keywords: 'bots automation', action: () => router.push('/bots') },
      { id: 'go-customers', title: 'ไปยัง · ลูกค้า', keywords: 'customers 360 persona', action: () => router.push('/customers') },
      { id: 'go-events', title: 'ไปยัง · อีเวนต์', keywords: 'events stream feed', action: () => router.push('/events') },
      { id: 'toggle-focus', title: 'สลับโหมดโฟกัส', hint: 'F', keywords: 'focus dim', action: () => setFocusMode(!useWarroom.getState().focusMode) },
      { id: 'toggle-freeze', title: 'สลับการแช่แข็ง', hint: 'Space', keywords: 'freeze pause hold', action: () => setFrozen(!useWarroom.getState().frozen) },
      { id: 'toggle-mute', title: 'สลับเสียงเตือน', hint: 'M', keywords: 'mute audio sound', action: () => setMuted(!useWarroom.getState().muted) },
    ],
    [router, setFocusMode, setFrozen, setMuted],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => (c.title + ' ' + c.keywords).toLowerCase().includes(needle));
  }, [q, commands]);

  useEffect(() => {
    if (cmdkOpen) {
      setQ('');
      setSel(0);
    }
  }, [cmdkOpen]);

  useEffect(() => setSel(0), [q]);

  if (!cmdkOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm grid place-items-start pt-24"
      onClick={() => setCmdkOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-auto bg-panel border border-line rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 h-11 border-b border-line">
          <Search size={14} className="text-mute" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(filtered.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                filtered[sel]?.action();
                setCmdkOpen(false);
              } else if (e.key === 'Escape') {
                setCmdkOpen(false);
              }
            }}
            placeholder="ค้นหา ลูกค้า · บิล · เคส · คำสั่ง"
            className="flex-1 bg-transparent border-0 text-sm text-fg outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-mute text-center">ไม่พบคำสั่งที่ตรงกัน</div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                onClick={() => {
                  c.action();
                  setCmdkOpen(false);
                }}
                onMouseEnter={() => setSel(i)}
                className={cn(
                  'w-full flex items-center justify-between text-left px-3 py-2 text-sm border-b border-lined last:border-b-0',
                  i === sel ? 'bg-info/10 text-fg' : 'text-dim hover:bg-rowhi',
                )}
              >
                <span>{c.title}</span>
                {c.hint && <Kbd>{c.hint}</Kbd>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
