'use client';

import { useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { Kbd } from '@/components/ui/Kbd';
import { PendingApiBanner } from '@/components/ui/PendingApiBanner';
import { useWarroom } from '@/lib/stores/warroom';
import { cn } from '@/lib/utils';

type Provider = {
  id: string;
  label: string;
  model: string;
  color: string;
  latency: string;
  cost: string;
};

const PROVIDERS: Provider[] = [
  { id: 'gemini', label: 'Gemini Pro', model: 'gemini-2.0-flash-exp', color: '#22d3ee', latency: '342ms', cost: '฿0.0042' },
  { id: 'groq', label: 'Groq Llama', model: 'llama-3.3-70b-versatile', color: '#10b981', latency: '186ms', cost: '฿0.0019' },
  { id: 'qwen', label: 'Qwen-72B', model: 'qwen-2.5-72b-instruct', color: '#8b5cf6', latency: '1,420ms', cost: '฿0.0028' },
];

const TEMPLATES = [
  { id: 'celtic', name: 'Celtic Cross — ความรัก', icon: '🔮', prompt: 'อ่านไพ่ Celtic Cross 10 ใบ เรื่องความรักของลูกค้า ชื่อ {name} เกิด {dob} คำถาม: "{question}"\n\nไพ่ที่จั่วได้: {cards}\n\nกรุณาตอบเป็นภาษาไทย เป็นกันเอง ใช้คำว่า "ค่ะ" และ "นะคะ" อย่างเหมาะสม' },
  { id: 'monthly', name: 'ดวงรายเดือน', icon: '🌙', prompt: 'พยากรณ์ดวงเดือน {month} ปี 2569 สำหรับ {name} ราศี {zodiac} โดยแบ่งหัวข้อ: ความรัก งาน การเงิน สุขภาพ — แต่ละหัวข้อ 2 ประโยค ใช้น้ำเสียงเป็นกันเองและให้กำลังใจ' },
  { id: 'tarot3', name: 'ทาโรต์ 3 ใบ', icon: '🎴', prompt: 'อ่านไพ่ทาโรต์ 3 ใบ (อดีต ปัจจุบัน อนาคต) สำหรับลูกค้า {name} เรื่อง "{question}"\nไพ่: {cards}\n\nตอบเป็นภาษาไทย ความยาว 3 ย่อหน้า ใช้คำที่อ่านง่าย ไม่ใช้ศัพท์ยาก' },
  { id: 'numerology', name: 'ตัวเลขศาสตร์', icon: '🔢', prompt: 'วิเคราะห์ตัวเลขชีวิตของ {name} เกิด {dob} ตามหลัก Pythagorean — แสดง Life Path Number, Expression Number, Birth Day Number พร้อมตีความเป็นภาษาไทย' },
];

const SAMPLE_RESULTS: Record<string, string> = {
  gemini:
    'จากไพ่ที่จั่วได้ทั้ง 10 ใบ Celtic Cross บอกเล่าเรื่องราวความรักของคุณพิมพ์ชนกได้ชัดเจนค่ะ ✨\n\nใบที่ 1 (ปัจจุบัน): The Tower — บอกถึงความเปลี่ยนแปลงที่เพิ่งเกิดขึ้นในชีวิตรัก ความสัมพันธ์เดิมที่จบลงไม่ได้เกิดจากความผิดของคุณนะคะ แต่เป็นการพังลงของบางสิ่งที่ไม่มั่นคงมาตั้งแต่ต้น\n\nใบที่ 2 (อุปสรรค): Three of Swords (กลับหัว) — แม้จะเจ็บปวด แต่ใจของคุณเริ่มฟื้นตัวแล้วค่ะ คุณกำลังเรียนรู้ที่จะปล่อยวาง\n\nใบที่ 3 (อนาคตใกล้): The Star — สัญญาณดีมากค่ะ ✨ มีคนใหม่กำลังจะเข้ามาในชีวิต ช่วงปลายเดือนกรกฎาคม...',
  groq:
    'Celtic Cross spread ของคุณพิมพ์ชนกบ่งบอกถึงการเปลี่ยนผ่านที่สำคัญในเรื่องความรัก:\n\n1. ปัจจุบัน — มีพายุผ่านเข้ามาเร็วๆนี้ ทำให้บางอย่างต้องจบลง\n2. อุปสรรค — ความเจ็บปวดในใจที่ค่อยๆลดลง\n3. อดีต — ความรักที่จริงใจในอดีตที่ทิ้งบทเรียนไว้\n4. อนาคตใกล้ — โอกาสใหม่ที่ส่องประกายความหวัง\n\nคำแนะนำ: ในเดือนนี้ให้เปิดใจรับสิ่งใหม่ ไม่ต้องรีบเข้าหา แต่ให้สังเกตคนรอบข้างที่เข้ามาด้วยความจริงใจค่ะ',
  qwen:
    'ตามไพ่ Celtic Cross ที่จั่วได้สำหรับคุณพิมพ์ชนก เรื่องความรักหลังเลิกแฟน:\n\n• สถานการณ์ปัจจุบัน: The Tower ↑ — การพังทลายของความสัมพันธ์เดิมเปิดทางให้กับชีวิตใหม่ คุณกำลังอยู่ในจุดที่เจ็บปวดแต่ก็เป็นจุดเริ่มต้น\n• พลังที่ขัดขวาง: Three of Swords ↓ (กลับหัว) — ความเศร้าเริ่มจางลง แสดงถึงการเยียวยา\n• พื้นฐาน: The Lovers ↑ — ความรักที่ผ่านมาเป็นของจริง แต่ถึงเวลาต้องเดินต่อ\n• อนาคต 3 เดือน: The Star ↑ — โอกาสและความหวังใหม่กำลังก่อตัว\n\nสรุป: คุณกำลังก้าวผ่านช่วงเปลี่ยนผ่าน ซึ่งเจ็บปวดแต่จำเป็น สิ่งดีๆ กำลังรออยู่ในอีกไม่นานค่ะ ✨',
};

export default function PredictPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [prompt, setPrompt] = useState(TEMPLATES[0].prompt);
  const [active, setActive] = useState<Record<string, boolean>>({ gemini: true, groq: true, qwen: false });
  const [results, setResults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const pushToast = useWarroom((s) => s.pushToast);

  const run = () => {
    setRunning(true);
    setResults({});
    const enabled = PROVIDERS.filter((p) => active[p.id]);
    enabled.forEach((p, i) => {
      setTimeout(() => {
        setResults((r) => ({ ...r, [p.id]: SAMPLE_RESULTS[p.id] }));
        if (i === enabled.length - 1) setRunning(false);
      }, 600 + i * 800);
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <PendingApiBanner
        endpoint="/ai/playground/run (3 providers parallel)"
        rationale="ต้อง endpoint run prompt → providers ทั้ง 3 ตัวพร้อมกัน ฝั่งนี้เป็น UI shell อย่างเดียว"
      />
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-mystic" />
        <span className="t-h">Workbench · ทดสอบทำนาย</span>
        <Pill tone="mystic">A/B test · กับ 3 providers</Pill>
        <div className="flex-1" />
        <button
          onClick={() => pushToast({ kind: 'mystic', title: 'บันทึก preset แล้ว', body: selectedTemplate.name })}
          className="btn"
        >
          💾 บันทึก preset
        </button>
        <button
          onClick={run}
          disabled={running || Object.values(active).every((v) => !v)}
          className="btn btn-primary disabled:opacity-40"
        >
          {running ? '⏳ กำลังรัน...' : '▶ รันทดสอบ'} <Kbd>⌘↵</Kbd>
        </button>
      </header>

      <div className="grid flex-1 min-h-0 overflow-hidden" style={{ gridTemplateColumns: '320px 1fr' }}>
        <aside className="border-r border-line flex flex-col min-h-0 bg-panel2/30">
          <div className="px-3 py-2 border-b border-line">
            <div className="t-h">เทมเพลต</div>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t);
                  setPrompt(t.prompt);
                }}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-lined hover:bg-rowhi flex items-center gap-2',
                  selectedTemplate.id === t.id && 'bg-info/8 border-l-2 border-l-info',
                )}
              >
                <span className="text-base">{t.icon}</span>
                <span className="text-sm text-fg flex-1">{t.name}</span>
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-line">
            <div className="t-h mb-2">เลือก provider</div>
            <div className="space-y-1.5">
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded border border-line bg-panel hover:bg-rowhi cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={active[p.id]}
                    onChange={(e) => setActive((s) => ({ ...s, [p.id]: e.target.checked }))}
                  />
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <div className="flex-1">
                    <div className="text-xs text-fg">{p.label}</div>
                    <div className="text-2xs text-mute mono">{p.model}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xs mono text-dim">{p.latency}</div>
                    <div className="text-2xs mono text-mute">{p.cost}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-line bg-panel2/40 shrink-0 flex items-center gap-2">
            <span className="t-h">Prompt</span>
            <span className="text-2xs text-mute">ใช้ตัวแปร: {`{name}`}, {`{dob}`}, {`{question}`}, {`{cards}`}, {`{zodiac}`}, {`{month}`}</span>
            <div className="flex-1" />
            <span className="text-2xs text-mute">{prompt.length} ตัวอักษร</span>
          </div>
          <div className="p-3 border-b border-line shrink-0">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full p-2 text-xs mono resize-none"
              placeholder="พิมพ์ prompt..."
            />
          </div>

          <div className="px-3 py-2 border-b border-line bg-panel2/40 shrink-0 flex items-center gap-2">
            <span className="t-h">ผลลัพธ์ · เปรียบเทียบ</span>
            <div className="flex-1" />
            {Object.keys(results).length > 0 && (
              <button
                onClick={() => pushToast({ kind: 'ok', title: 'คัดลอกแล้ว' })}
                className="btn"
              >
                📋 คัดลอกทั้งหมด
              </button>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-auto p-3 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, PROVIDERS.filter((p) => active[p.id]).length)}, minmax(0,1fr))`,
            }}
          >
            {PROVIDERS.filter((p) => active[p.id]).map((p) => (
              <div key={p.id} className="panel flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="text-sm font-semibold text-fg">{p.label}</span>
                  <span className="text-2xs text-mute mono">{p.model}</span>
                  <div className="flex-1" />
                  {results[p.id] && (
                    <>
                      <Pill tone="ok">{p.latency}</Pill>
                      <Pill tone="dim">{p.cost}</Pill>
                    </>
                  )}
                </div>
                <div className="p-3 flex-1 overflow-y-auto min-h-0 text-sm leading-relaxed text-fg whitespace-pre-wrap">
                  {running && !results[p.id] && (
                    <div className="text-mute flex items-center gap-1.5">
                      <span className="inline-flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-info animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-info animate-pulse" style={{ animationDelay: '.2s' }} />
                        <span className="w-1 h-1 rounded-full bg-info animate-pulse" style={{ animationDelay: '.4s' }} />
                      </span>
                      กำลังประมวลผล...
                    </div>
                  )}
                  {results[p.id] && results[p.id]}
                  {!running && !results[p.id] && <div className="text-mute text-xs">กดปุ่ม ▶ รันทดสอบ เพื่อเริ่มต้น</div>}
                </div>
                {results[p.id] && (
                  <div className="px-3 py-2 border-t border-line flex items-center gap-1.5">
                    <button className="btn btn-ok text-2xs">👍 ดี</button>
                    <button className="btn btn-warn text-2xs">😐 พอใช้</button>
                    <button className="btn btn-crit text-2xs">👎 ไม่ดี</button>
                    <div className="flex-1" />
                    <button className="btn text-2xs">💾 บันทึก</button>
                  </div>
                )}
              </div>
            ))}

            {PROVIDERS.filter((p) => active[p.id]).length === 0 && (
              <div className="col-span-full grid place-items-center text-sm text-mute">
                เลือก provider อย่างน้อย 1 ตัวเพื่อเริ่มทดสอบ
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
