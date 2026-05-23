'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { useEve } from '@/lib/stores/eve';
import {
  loginAndPair,
  verifyTwoFactorAndPair,
  pairConnection,
  verifyConnection,
  type PairUser,
} from '@/lib/api';
import { EveAvatar } from '@/components/eve/EveAvatar';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, LogIn, ShieldCheck, Plug } from 'lucide-react';

const ENDPOINT_SUGGESTIONS = [
  'https://thaiprompt.online/api/admin',
  'https://staging.thaiprompt.online/api/admin',
  'http://localhost:8000/api/admin',
];

type AuthMethod = 'password' | 'token';

export default function LoginPage() {
  const router = useRouter();
  const conn = useSettings((s) => s.connection);
  const paired = useSettings((s) => isPairedFn(s));
  const setMood = useEve((s) => s.setMood);

  // On mount: if user already has a saved token, try verifying it. If valid,
  // skip the login page entirely and bounce to the warroom home.
  useEffect(() => {
    if (paired) {
      router.replace('/');
      return;
    }
    if (conn.token && conn.baseUrl && conn.status !== 'testing') {
      void verifyConnection().then((res) => {
        if (res.ok) router.replace('/');
      });
    }
    // Make Eve look welcoming
    setMood('happy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-redirect whenever pairing status flips to true (e.g. after successful login)
  useEffect(() => {
    if (paired) router.replace('/');
  }, [paired, router]);

  // ── Shared base URL ──
  const [baseUrl, setBaseUrl] = useState(conn.baseUrl || ENDPOINT_SUGGESTIONS[0]);
  // ── Method tabs ──
  const [method, setMethod] = useState<AuthMethod>('password');
  // ── Flash ──
  const [flash, setFlash] = useState<{ tone: 'ok' | 'crit'; msg: string } | null>(null);

  return (
    <div
      className="h-full w-full grid"
      style={{
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(380px, 1fr)',
        background:
          'radial-gradient(circle at 20% 10%, rgba(139, 92, 246, .18), transparent 55%),' +
          'radial-gradient(circle at 85% 90%, rgba(34, 211, 238, .12), transparent 55%),' +
          'linear-gradient(135deg, #1a1330, #0a0e17 60%)',
      }}
    >
      {/* ───────────────────────── LEFT — branding + Eve ───────────────────────── */}
      <section className="relative overflow-hidden hidden md:block">
        {/* Backdrop layers */}
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute inset-0 scanline opacity-40 pointer-events-none" />

        {/* Floating sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          <span className="login-spark" style={{ left: '15%', top: '20%', animationDelay: '0s' }} />
          <span className="login-spark" style={{ left: '85%', top: '25%', animationDelay: '-2s' }} />
          <span className="login-spark" style={{ left: '70%', top: '70%', animationDelay: '-3.5s' }} />
          <span className="login-spark" style={{ left: '22%', top: '75%', animationDelay: '-1.4s' }} />
          <span className="login-spark" style={{ left: '50%', top: '12%', animationDelay: '-0.7s' }} />
          <span className="login-spark" style={{ left: '38%', top: '90%', animationDelay: '-4.2s' }} />
        </div>

        {/* Logo + tagline (top) */}
        <header className="relative z-10 flex items-center gap-3 px-8 pt-6">
          <div className="relative w-10 h-10 rounded-md overflow-hidden border border-mystic/40 shadow-[0_0_18px_rgba(139,92,246,.35)]">
            <Image
              src="/assets/juntra-logo.png"
              alt="Juntra"
              fill
              sizes="40px"
              priority
              className="object-cover"
            />
          </div>
          <div>
            <div className="font-rune text-lg tracking-[.25em] text-fg leading-none">JUNTRA</div>
            <div className="text-2xs mono text-mystic mt-0.5 tracking-widest">WAR ROOM · MISSION CONTROL</div>
          </div>
        </header>

        {/* Eve full-size, centered */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <EveAvatar scale={2.4} />
        </div>

        {/* Bottom welcome block */}
        <footer className="absolute bottom-8 left-8 right-8 z-10">
          <div className="font-rune text-2xl tracking-[.3em] text-mystic leading-none">EVE</div>
          <div className="text-fg text-base mt-1.5 font-medium">สวัสดีค่ะ พี่ ✦</div>
          <div className="text-mute text-xs mt-1 max-w-md leading-relaxed">
            Eve รออยู่ใน War Room — ล็อกอินเพื่อเริ่มกะ Eve จะคอยสรุปคิว ตอบคำถาม
            และช่วยพี่จัดการคำสั่งด้วยเสียงค่ะ
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Pill tone="mystic">v0.7 · Groq Llama 3.3 70b</Pill>
            <Pill tone="ok">● ออนไลน์</Pill>
          </div>
        </footer>
      </section>

      {/* ───────────────────────── RIGHT — auth form ───────────────────────── */}
      <section className="relative flex flex-col bg-panel/70 backdrop-blur-xl border-l border-mystic/15 overflow-y-auto">
        {/* Mobile-only logo top */}
        <div className="md:hidden flex items-center gap-3 px-6 pt-5">
          <div className="relative w-9 h-9 rounded-md overflow-hidden border border-mystic/40">
            <Image src="/assets/juntra-logo.png" alt="Juntra" fill sizes="36px" priority className="object-cover" />
          </div>
          <div>
            <div className="font-rune text-base tracking-[.25em] text-fg leading-none">JUNTRA</div>
            <div className="text-2xs mono text-mystic mt-0.5">WAR ROOM</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 md:px-10 py-8 max-w-md mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-fg text-xl font-semibold leading-tight">เข้าสู่ระบบ</h1>
            <p className="text-mute text-xs mt-1 leading-relaxed">
              Login ด้วยอีเมล/รหัสผ่านของ admin thaiprompt
              {' · '}
              หรือใช้ Sanctum token ที่ออกแล้ว
            </p>
          </div>

          {/* Method tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-line">
            <MethodTab active={method === 'password'} onClick={() => setMethod('password')}>
              <LogIn size={12} /> อีเมล + รหัสผ่าน
            </MethodTab>
            <MethodTab active={method === 'token'} onClick={() => setMethod('token')}>
              <Plug size={12} /> Sanctum Token
            </MethodTab>
          </div>

          {/* Shared Base URL */}
          <div className="mb-4">
            <label className="text-2xs text-mute block mb-1">Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://thaiprompt.online/api/admin"
              spellCheck={false}
              className="w-full px-2.5 py-2 text-xs mono"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ENDPOINT_SUGGESTIONS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setBaseUrl(url)}
                  className="text-2xs px-1.5 py-0.5 rounded border border-line text-dim hover:text-fg hover:border-mystic/40 transition"
                >
                  {url.replace(/^https?:\/\//, '')}
                </button>
              ))}
            </div>
          </div>

          {/* Method panels */}
          {method === 'password' ? (
            <PasswordLoginPanel
              baseUrl={baseUrl}
              onSuccess={(user) => setFlash({ tone: 'ok', msg: `เข้าสู่ระบบสำเร็จ — สวัสดี ${user.name}` })}
              onError={(msg) => setFlash({ tone: 'crit', msg })}
            />
          ) : (
            <TokenPairPanel
              baseUrl={baseUrl}
              onSuccess={(user) => setFlash({ tone: 'ok', msg: `เชื่อมต่อสำเร็จ — สวัสดี ${user.name}` })}
              onError={(msg) => setFlash({ tone: 'crit', msg })}
            />
          )}

          {flash && (
            <div
              className={cn(
                'mt-4 rounded border p-2.5 text-xs',
                flash.tone === 'ok'
                  ? 'border-ok/40 bg-ok/10 text-ok'
                  : 'border-crit/40 bg-crit/10 text-crit',
              )}
            >
              {flash.msg}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-line text-2xs text-mute leading-relaxed">
            <div className="mb-1">💡 <b>เคล็ดลับ:</b></div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Base URL ต้องลงท้ายด้วย <code className="mono text-fg">/api/admin</code></li>
              <li>ฝั่ง thaiprompt ต้องเปิด CORS ให้ origin ของ warroom (ดู <code className="mono">config/cors.php</code>)</li>
              <li>หรือออก token ผ่าน <code className="mono text-fg">tinker</code>: <code className="mono">{`User::find(id)->createToken('warroom', ['admin'])->plainTextToken`}</code></li>
            </ul>
          </div>
        </div>

        <footer className="px-6 md:px-10 pb-5 text-center">
          <div className="text-2xs text-mute">
            Warroom Juntra · Mission Control
          </div>
        </footer>
      </section>

      <style jsx>{`
        .login-spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #c4b5fd;
          box-shadow: 0 0 12px #c4b5fd, 0 0 24px rgba(196, 181, 253, 0.6);
          opacity: 0.7;
          animation: login-spark-float 9s linear infinite;
        }
        @keyframes login-spark-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 0.9; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-180px) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────

function MethodTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border-b-2 transition',
        active
          ? 'border-mystic text-fg bg-mystic/5'
          : 'border-transparent text-mute hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function PasswordLoginPanel({
  baseUrl,
  onSuccess,
  onError,
}: {
  baseUrl: string;
  onSuccess: (user: PairUser) => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (twoFactorChallenge) codeRef.current?.focus();
  }, [twoFactorChallenge]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (twoFactorChallenge) {
        const res = await verifyTwoFactorAndPair({ baseUrl, challenge_token: twoFactorChallenge, code });
        if (res.ok) {
          setTwoFactorChallenge(null);
          setPassword('');
          setCode('');
          onSuccess(res.user);
        } else {
          onError(res.error);
        }
      } else {
        const res = await loginAndPair({ baseUrl, email, password });
        if (res.ok) {
          setPassword('');
          onSuccess(res.user);
        } else if ('requires_2fa' in res) {
          setTwoFactorChallenge(res.challenge_token);
        } else {
          onError(res.error);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const showStage2 = !!twoFactorChallenge;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {showStage2 ? (
        <>
          <div className="flex items-center gap-2 text-xs text-warn">
            <ShieldCheck size={14} /> รอรหัส 2FA จากแอป Authenticator (6 หลัก)
          </div>
          <div>
            <label className="text-2xs text-mute block mb-1">รหัส 2FA</label>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoComplete="one-time-code"
              spellCheck={false}
              className="w-full px-3 py-2.5 text-lg mono tracking-[.3em] text-center"
              disabled={busy}
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="btn btn-primary flex-1 justify-center"
            >
              <ShieldCheck size={12} />
              {busy ? 'กำลังยืนยัน...' : 'ยืนยัน + เข้าสู่ระบบ'}
            </button>
            <button
              type="button"
              onClick={() => { setTwoFactorChallenge(null); setCode(''); }}
              className="btn btn-ghost"
              disabled={busy}
            >
              ยกเลิก
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-2xs text-mute block mb-1">อีเมล admin</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@thaiprompt.online"
              autoComplete="username"
              spellCheck={false}
              className="w-full px-3 py-2 text-sm mono"
              disabled={busy}
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-2xs text-mute">รหัสผ่าน</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-2xs text-dim hover:text-fg inline-flex items-center gap-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={10} /> : <Eye size={10} />}
                {showPassword ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm"
              disabled={busy}
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy || !baseUrl || !email || !password}
            className="btn btn-primary w-full justify-center mt-1"
          >
            <LogIn size={12} />
            {busy ? 'กำลังเข้าระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </>
      )}
    </form>
  );
}

function TokenPairPanel({
  baseUrl,
  onSuccess,
  onError,
}: {
  baseUrl: string;
  onSuccess: (user: PairUser) => void;
  onError: (msg: string) => void;
}) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await pairConnection({ baseUrl, token });
      if (res.ok) {
        setToken('');
        onSuccess(res.user);
      } else {
        onError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-2xs text-mute">API Token (Sanctum)</label>
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="text-2xs text-dim hover:text-fg inline-flex items-center gap-1"
            tabIndex={-1}
          >
            {showToken ? <EyeOff size={10} /> : <Eye size={10} />}
            {showToken ? 'ซ่อน' : 'แสดง'}
          </button>
        </div>
        <input
          type={showToken ? 'text' : 'password'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="1|XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
          spellCheck={false}
          autoComplete="off"
          className="w-full px-3 py-2 text-xs mono"
          disabled={busy}
          required
        />
        <div className="text-2xs text-mute mt-1">
          ออก token ผ่าน <code className="mono text-fg">tinker</code> หรือสแกน QR pair_code จากแอด admin
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || !baseUrl || !token}
        className="btn btn-primary w-full justify-center"
      >
        <Plug size={12} />
        {busy ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อด้วย Token'}
      </button>
    </form>
  );
}
