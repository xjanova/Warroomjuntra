'use client';

import { useEve, type EveMood } from '@/lib/stores/eve';
import { EveAvatar } from '@/components/eve/EveAvatar';
import { EveChatBody } from '@/components/eve/EveChatBody';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';

const MOODS: EveMood[] = ['idle', 'happy', 'talking', 'thinking', 'concerned', 'surprise'];

const MOOD_LABEL: Record<EveMood, string> = {
  idle: 'ปกติ',
  happy: 'มีความสุข',
  talking: 'กำลังพูด',
  thinking: 'คิดอยู่',
  concerned: 'กังวล',
  surprise: 'ตกใจ',
};

export default function EvePage() {
  const { mood, setMood, clearMessages, messages } = useEve();

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-mystic" />
        <span className="t-h">คุย Eve · AI ASSIST</span>
        <Pill tone="mystic">v0.7 · qwen-72b</Pill>
        <Pill tone="ok">● ออนไลน์ · {MOOD_LABEL[mood]}</Pill>
        <div className="flex-1" />
        <button onClick={clearMessages} className="btn btn-crit">
          🗑 ล้างประวัติ ({messages.length})
        </button>
      </header>

      <main
        className="flex-1 grid min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}
      >
        {/* LEFT — huge Eve */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 30% -10%, rgba(139, 92, 246, .22), transparent 50%), radial-gradient(circle at 80% 110%, rgba(34, 211, 238, .12), transparent 50%), linear-gradient(135deg, #1a1330, #0a0e17 60%)',
          }}
        >
          {/* Decorative grid backdrop */}
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="absolute inset-0 scanline opacity-50 pointer-events-none" />

          {/* Floating sparkles (extra, big variant) */}
          <div className="absolute inset-0 pointer-events-none">
            <span className="big-spark" style={{ left: '12%', top: '20%', animationDelay: '0s' }} />
            <span className="big-spark" style={{ left: '85%', top: '30%', animationDelay: '-1.8s' }} />
            <span className="big-spark" style={{ left: '70%', top: '75%', animationDelay: '-3.4s' }} />
            <span className="big-spark" style={{ left: '20%', top: '70%', animationDelay: '-2.1s' }} />
            <span className="big-spark" style={{ left: '55%', top: '15%', animationDelay: '-0.9s' }} />
            <span className="big-spark" style={{ left: '40%', top: '88%', animationDelay: '-4s' }} />
          </div>

          {/* Eve — centered and big */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <EveAvatar scale={3} />
          </div>

          {/* Mood selector overlay (bottom-left) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">
            <div className="t-h text-mystic mr-2">MOOD</div>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMood(m)}
                className={cn(
                  'pill cursor-pointer',
                  mood === m ? 'pill-mystic' : 'pill-dim',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Name plate (top-left) */}
          <div className="absolute top-3 left-3 z-10">
            <div className="text-fg font-rune text-xl tracking-[.2em]">EVE</div>
            <div className="text-2xs text-mute mono mt-0.5">AI ASSIST · LIVE WAR ROOM</div>
          </div>
        </section>

        {/* RIGHT — chat */}
        <section className="flex flex-col bg-panel border-l border-line min-h-0">
          <div className="px-4 py-3 border-b border-line shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-rune text-base tracking-[.2em] text-mystic">EVE</span>
              <Pill tone="mystic">AI ASSIST</Pill>
              <div className="flex-1" />
              <span className="text-2xs text-mute mono">v0.7 · qwen-72b</span>
            </div>
            <div className="text-2xs text-dim mt-1">
              ผู้ช่วย AI ประจำ War Room — สรุปคิว · ตอบคำถาม · แจ้งเตือนเคสวิกฤต
            </div>
          </div>

          <EveChatBody compact={false} className="flex-1 min-h-0" />
        </section>
      </main>

      <style jsx>{`
        .big-spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #c4b5fd;
          box-shadow: 0 0 12px #c4b5fd, 0 0 24px rgba(196, 181, 253, 0.6);
          opacity: 0.7;
          animation: big-spark-float 8s linear infinite;
        }
        @keyframes big-spark-float {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          20% {
            opacity: 0.9;
          }
          80% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-160px) scale(0.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
