'use client';

import { useMemo, useState } from 'react';
import { CUSTOMERS, type CustomerCard, type Rarity } from '@/lib/mock/customers';
import { ChannelChip, Pill } from '@/components/ui/Pill';

type SortKey = 'ltv' | 'recent' | 'readings';

const RARITY_BORDERS: Record<Rarity, string> = {
  LEGENDARY: 'border-warn/50 shadow-[0_0_24px_rgba(245,158,11,.15)]',
  EPIC: 'border-mystic/50',
  RARE: 'border-info/40',
  UNCOMMON: 'border-ok/40',
  COMMON: 'border-line',
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [chan, setChan] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState<SortKey>('ltv');
  const [vipOnly, setVipOnly] = useState(false);
  const [problemOnly, setProblemOnly] = useState(false);

  const filtered: CustomerCard[] = useMemo(() => {
    const r = CUSTOMERS.filter((c) => {
      if (chan && c.channel !== chan) return false;
      if (rarity && c.rarity !== rarity) return false;
      if (vipOnly && !c.vip) return false;
      if (problemOnly && !c.problem) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sort === 'ltv') r.sort((a, b) => b.ltv - a.ltv);
    else if (sort === 'readings') r.sort((a, b) => b.readings - a.readings);
    return r;
  }, [search, chan, rarity, sort, vipOnly, problemOnly]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-info" />
        <span className="t-h">ลูกค้า · CUSTOMERS</span>
        <Pill tone="info">{CUSTOMERS.length} แสดง · 2,481 รวม</Pill>
      </header>

      <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="ค้นหา ชื่อ / PSID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-2 py-1 w-72"
        />
        <select value={chan} onChange={(e) => setChan(e.target.value)} className="text-xs px-1.5 py-1">
          <option value="">ทุกช่อง</option>
          <option>FB</option>
          <option>LINE</option>
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="text-xs px-1.5 py-1">
          <option value="">ทุกระดับ</option>
          <option>LEGENDARY</option>
          <option>EPIC</option>
          <option>RARE</option>
          <option>UNCOMMON</option>
          <option>COMMON</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="text-xs px-1.5 py-1">
          <option value="ltv">LTV สูงสุด</option>
          <option value="recent">มาล่าสุด</option>
          <option value="readings">ดูดวงบ่อย</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} />
          <span className="text-fg">VIP เท่านั้น</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={problemOnly} onChange={(e) => setProblemOnly(e.target.checked)} />
          <span className="text-fg">ลูกค้าปัญหา</span>
        </label>
        <div className="flex-1" />
        <button className="btn">📥 ส่งออก</button>
        <button className="btn btn-primary">📨 broadcast</button>
      </div>

      <main
        className="flex-1 p-3 grid gap-3 min-h-0 overflow-y-auto"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
      >
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`relative overflow-hidden rounded-lg border ${RARITY_BORDERS[c.rarity]}`}
            style={{
              background:
                'radial-gradient(circle at top right, rgba(139,92,246,.18), transparent 50%), linear-gradient(135deg, #1a1330, #0d1320)',
            }}
          >
            <div className="p-3">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full grid place-items-center font-rune font-semibold text-xs bg-gradient-to-br from-mystic/30 to-info/20 border border-mystic/50 text-violet-200 shrink-0">
                  {c.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-fg truncate">{c.name}</span>
                    {c.vip && <span className="text-warn text-2xs">★</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <ChannelChip channel={c.channel === 'LINE' ? 'line' : 'fb'} />
                    <Pill tone="mystic">{c.rarity}</Pill>
                    {c.problem && <Pill tone="rose">⚠ ปัญหา</Pill>}
                  </div>
                  <div className="text-2xs text-mute mono mt-1">PSID {c.psid}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 mt-3 text-2xs">
                <div className="bg-panel/80 rounded p-1.5">
                  <div className="text-mute">LTV</div>
                  <div className="mono text-ok font-semibold">฿{(c.ltv / 1000).toFixed(1)}k</div>
                </div>
                <div className="bg-panel/80 rounded p-1.5">
                  <div className="text-mute">เครดิต</div>
                  <div className="mono text-info font-semibold">{c.credits}</div>
                </div>
                <div className="bg-panel/80 rounded p-1.5">
                  <div className="text-mute">ดูดวง</div>
                  <div className="mono text-fg font-semibold">{c.readings}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-2xs text-mute">EXP</span>
                <div className="flex-1 h-1 bg-panel rounded">
                  <div className="h-full rounded bg-gradient-to-r from-mystic to-info" style={{ width: `${c.exp}%` }} />
                </div>
                <span className="text-2xs text-mute mono">{c.exp}%</span>
              </div>

              <div className="mt-2 flex items-center gap-0.5 h-4">
                {c.sentiment.split('').map((s, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full rounded-sm"
                    style={{
                      background:
                        s === '+'
                          ? 'rgba(16,185,129,.5)'
                          : s === '-'
                          ? 'rgba(239,68,68,.5)'
                          : 'rgba(75,85,99,.2)',
                    }}
                  />
                ))}
              </div>
              <div className="text-2xs text-mute mono mt-1">sentiment 14 วันล่าสุด</div>

              <div className="grid grid-cols-3 gap-1 mt-3">
                <button className="btn justify-center text-2xs py-1">💬 แชต</button>
                <button className="btn justify-center text-2xs py-1">🔮 ทำนาย</button>
                <button className="btn justify-center text-2xs py-1">+ เครดิต</button>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
