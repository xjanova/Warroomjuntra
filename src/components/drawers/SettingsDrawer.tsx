'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWarroom } from '@/lib/stores/warroom';
import {
  useSettings,
  type LayoutMode,
  type RefreshInterval,
  type SoundProfile,
} from '@/lib/stores/settings';
import { DrawerShell } from './DrawerShell';
import { Switch } from '@/components/ui/Switch';
import { Pill } from '@/components/ui/Pill';
import { pairConnection, verifyConnection, fetchPlaygroundProviders, eveChat, type PlaygroundProvider } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  getVoices,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak as ttsSpeak,
} from '@/lib/eve/voice';
import { ACTION_VOCABULARY } from '@/lib/eve/actions';
import {
  Plug,
  Bell,
  Volume2,
  LayoutGrid,
  Clock,
  Wrench,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
} from 'lucide-react';

type TabKey = 'connect' | 'eve' | 'sla' | 'notif' | 'sound' | 'layout' | 'shift' | 'advanced';

const TABS: { k: TabKey; label: string; icon: any }[] = [
  { k: 'connect', label: 'เชื่อมต่อ', icon: Plug },
  { k: 'eve', label: 'Eve AI', icon: Sparkles },
  { k: 'sla', label: 'SLA', icon: Clock },
  { k: 'notif', label: 'แจ้งเตือน', icon: Bell },
  { k: 'sound', label: 'เสียง', icon: Volume2 },
  { k: 'layout', label: 'เลย์เอาต์', icon: LayoutGrid },
  { k: 'shift', label: 'กะ', icon: Clock },
  { k: 'advanced', label: 'ขั้นสูง', icon: Wrench },
];

const ENDPOINT_SUGGESTIONS = [
  'https://thaiprompt.online/api/admin',
  'https://staging.thaiprompt.online/api/admin',
  'http://localhost:8000/api/admin',
];

export function SettingsDrawer() {
  const { settingsOpen, setSettingsOpen } = useWarroom();
  const [tab, setTab] = useState<TabKey>('connect');

  return (
    <DrawerShell open={settingsOpen} onClose={() => setSettingsOpen(false)} width={560}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <button onClick={() => setSettingsOpen(false)} className="btn btn-ghost h-7 w-7 justify-center">
          ←
        </button>
        <span className="t-h">ตั้งค่า WAR ROOM</span>
        <div className="flex-1" />
        <ConnectionBadge />
      </div>

      <nav className="flex gap-1 px-3 pt-2 border-b border-line overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t border-b-2 transition whitespace-nowrap',
                active
                  ? 'border-info text-fg bg-panel2/60'
                  : 'border-transparent text-mute hover:text-fg'
              )}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {tab === 'connect' && <ConnectTab />}
        {tab === 'eve' && <EveTab />}
        {tab === 'sla' && <SlaTab />}
        {tab === 'notif' && <NotifTab />}
        {tab === 'sound' && <SoundTab />}
        {tab === 'layout' && <LayoutTab />}
        {tab === 'shift' && <ShiftTab />}
        {tab === 'advanced' && <AdvancedTab />}
      </div>
    </DrawerShell>
  );
}

// ---------- Connection badge (top-right of header) ----------

function ConnectionBadge() {
  const status = useSettings((s) => s.connection.status);
  if (status === 'paired')
    return <Pill tone="ok">เชื่อมต่อแล้ว</Pill>;
  if (status === 'testing')
    return <Pill tone="info">กำลังทดสอบ…</Pill>;
  if (status === 'error')
    return <Pill tone="crit">เชื่อมต่อล้มเหลว</Pill>;
  return <Pill tone="dim">ยังไม่ได้เชื่อมต่อ</Pill>;
}

// ---------- Tab: Connection ----------

function ConnectTab() {
  const conn = useSettings((s) => s.connection);
  const setBaseUrl = useSettings((s) => s.setBaseUrl);
  const setToken = useSettings((s) => s.setToken);
  const disconnect = useSettings((s) => s.disconnect);

  const [baseUrl, setBaseUrlLocal] = useState(conn.baseUrl);
  const [token, setTokenLocal] = useState(conn.token);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'crit'; msg: string } | null>(null);

  // keep local form in sync if store mutates from elsewhere (e.g. disconnect)
  useEffect(() => setBaseUrlLocal(conn.baseUrl), [conn.baseUrl]);
  useEffect(() => setTokenLocal(conn.token), [conn.token]);

  const dirty = baseUrl !== conn.baseUrl || token !== conn.token;
  const tokenMasked = useMemo(() => maskToken(conn.token), [conn.token]);

  async function onPair() {
    setBusy(true);
    setFlash(null);
    // commit form values to store so apiRequest can read them
    setBaseUrl(baseUrl);
    setToken(token);
    const res = await pairConnection({ baseUrl, token });
    if (res.ok) {
      setFlash({ tone: 'ok', msg: `เชื่อมต่อสำเร็จ — สวัสดี ${res.user.name}` });
    } else {
      setFlash({ tone: 'crit', msg: res.error });
    }
    setBusy(false);
  }

  async function onReverify() {
    setBusy(true);
    setFlash(null);
    const res = await verifyConnection();
    if (res.ok) {
      setFlash({ tone: 'ok', msg: 'ยังเชื่อมต่ออยู่' });
    } else {
      setFlash({ tone: 'crit', msg: res.error });
    }
    setBusy(false);
  }

  function onDisconnect() {
    if (!confirm('ยืนยันตัดการเชื่อมต่อ? Token จะถูกลบจากเครื่องนี้')) return;
    disconnect();
    setTokenLocal('');
    setFlash(null);
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="t-h mb-2">เชื่อมต่อกับ thaiprompt.online (Admin API)</div>
        <p className="text-mute leading-relaxed">
          ใช้ <span className="text-fg">Sanctum admin token</span> ที่มี ability{' '}
          <code className="mono text-fg">[&apos;admin&apos;]</code> ออกจาก thaiprompt.online ได้สามทาง:
        </p>
        <ol className="list-decimal list-inside text-mute leading-relaxed mt-1 space-y-0.5">
          <li>
            Admin มือถือ (Flutter) → สแกน QR pair_code (
            <code className="mono text-fg">POST /api/admin/auth/pair/claim</code>)
          </li>
          <li>
            Login admin web → tinker:{' '}
            <code className="mono text-fg">
              User::find(id)-&gt;createToken(&apos;warroom&apos;, [&apos;admin&apos;])-&gt;plainTextToken
            </code>
          </li>
          <li>หน้าจัดการ token ใน admin panel (ถ้ามี)</li>
        </ol>
        <p className="text-mute leading-relaxed mt-2">
          Base URL ต้องลงท้ายด้วย <code className="mono text-fg">/api/admin</code> เพราะ warroom
          เรียก endpoints แบบ <code className="mono text-fg">/auth/me</code>, <code className="mono text-fg">/dashboard</code>, <code className="mono text-fg">/fortune/readings</code> ฯลฯ
        </p>
      </section>

      <section className="space-y-2">
        <label className="block">
          <div className="text-dim mb-1">Base URL</div>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrlLocal(e.target.value)}
            placeholder="https://thaiprompt.online/api/admin"
            spellCheck={false}
            className="w-full px-2 py-1.5 text-xs mono"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ENDPOINT_SUGGESTIONS.map((url) => (
              <button
                key={url}
                onClick={() => setBaseUrlLocal(url)}
                className="text-2xs px-1.5 py-0.5 rounded border border-line text-dim hover:text-fg hover:border-info/50"
              >
                {url}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <div className="text-dim mb-1 flex items-center gap-2">
            <span>API Token</span>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="btn btn-ghost h-5 px-1.5 text-2xs"
            >
              {showToken ? <EyeOff size={10} /> : <Eye size={10} />}
              {showToken ? 'ซ่อน' : 'แสดง'}
            </button>
          </div>
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setTokenLocal(e.target.value)}
            placeholder="1|XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            spellCheck={false}
            autoComplete="off"
            className="w-full px-2 py-1.5 text-xs mono"
          />
          {conn.token && !dirty && !showToken && (
            <div className="text-2xs text-mute mt-1 mono">
              เก็บไว้: {tokenMasked}
            </div>
          )}
        </label>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !baseUrl || !token}
          onClick={onPair}
          className="btn btn-primary"
        >
          <Plug size={12} />
          {conn.status === 'paired' && !dirty ? 'ทดสอบใหม่' : 'เชื่อมต่อ'}
        </button>
        {conn.status === 'paired' && !dirty && (
          <button type="button" disabled={busy} onClick={onReverify} className="btn btn-info">
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
            รีเฟรชสถานะ
          </button>
        )}
        {(conn.token || conn.user) && (
          <button type="button" disabled={busy} onClick={onDisconnect} className="btn btn-crit">
            <Trash2 size={12} />
            ตัดการเชื่อมต่อ
          </button>
        )}
        <div className="flex-1" />
        <a
          href="https://github.com/xjanova/Thaiprompt-Affiliate#admin-api"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
        >
          <ExternalLink size={12} />
          วิธีออก token
        </a>
      </section>

      {flash && (
        <div
          className={cn(
            'rounded border p-2.5 text-xs',
            flash.tone === 'ok'
              ? 'border-ok/40 bg-ok/10 text-ok'
              : 'border-crit/40 bg-crit/10 text-crit'
          )}
        >
          {flash.msg}
        </div>
      )}

      <section className="bg-panel2 border border-line rounded p-3 space-y-1.5">
        <div className="t-h mb-1">สถานะปัจจุบัน</div>
        <KV label="สถานะ" value={<ConnectionBadge />} />
        {conn.user && (
          <>
            <KV label="ผู้ใช้" value={<span className="text-fg">{conn.user.name}</span>} />
            {conn.user.email && (
              <KV label="อีเมล" value={<span className="text-fg mono">{conn.user.email}</span>} />
            )}
            {conn.user.role && <KV label="role" value={<span className="text-fg">{conn.user.role}</span>} />}
          </>
        )}
        {conn.lastCheckAt && (
          <KV
            label="ตรวจล่าสุด"
            value={<span className="text-fg mono">{new Date(conn.lastCheckAt).toLocaleString('th-TH')}</span>}
          />
        )}
        {conn.lastError && conn.status === 'error' && (
          <KV
            label="ข้อความ"
            value={<span className="text-crit">{conn.lastError}</span>}
          />
        )}
      </section>

      <section className="bg-panel2 border border-line rounded p-3 space-y-1.5">
        <div className="t-h mb-1">หมายเหตุ CORS</div>
        <p className="text-mute leading-relaxed">
          warroom ทำ build แบบ static export — เรียก API ตรงจาก browser ไป thaiprompt.online
          ฝั่ง thaiprompt ต้องตั้งค่า{' '}
          <code className="mono text-fg">config/cors.php</code> ให้
          <code className="mono text-fg"> allowed_origins </code>มี origin ของ warroom
          (เช่น <span className="mono text-fg">https://warroom.thaiprompt.online</span>) และ
          <code className="mono text-fg"> paths </code>ครอบคลุม <span className="mono text-fg">api/admin/*</span>
          {' '}— middleware <code className="mono text-fg">admin.api</code> ต้องไม่ block preflight ด้วย
        </p>
      </section>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-dim w-20">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function maskToken(t: string): string {
  if (!t) return '';
  if (t.length <= 8) return '••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

// ---------- Tab: Eve AI ----------

function EveTab() {
  const eve = useSettings((s) => s.eve);
  const setEve = useSettings((s) => s.setEve);
  const paired = useSettings((s) => s.connection.status === 'paired');
  const [providers, setProviders] = useState<PlaygroundProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Test-call state
  const [testPrompt, setTestPrompt] = useState('สวัสดี Eve ตอนนี้ระบบเป็นยังไงบ้าง');
  const [testRunning, setTestRunning] = useState(false);
  const [testReply, setTestReply] = useState<{ ok: boolean; text: string; latency?: number; tokens?: number | null } | null>(null);

  useEffect(() => {
    if (!paired) return;
    setLoadingProviders(true);
    fetchPlaygroundProviders()
      .then((res) => setProviders(res.providers ?? []))
      .catch(() => setProviders([]))
      .finally(() => setLoadingProviders(false));
  }, [paired]);

  // Match the current provider against the live list. If no match (e.g. operator
  // typed a custom one), still show as a free-text option.
  const currentProvider = providers.find((p) => p.name === eve.provider);
  const modelOptions = currentProvider?.models ?? [];

  const runTest = async () => {
    setTestRunning(true);
    setTestReply(null);
    try {
      const res = await eveChat({
        message: testPrompt,
        provider: eve.provider,
        model: eve.model,
      });
      setTestReply({ ok: true, text: res.reply, latency: res.latency_ms, tokens: res.tokens });
    } catch (e) {
      setTestReply({ ok: false, text: String((e as Error).message) });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="dot dot-mystic" />
          <span className="font-semibold text-fg">ตัวช่วย Eve</span>
          <Pill tone={eve.enabled ? 'mystic' : 'dim'}>{eve.enabled ? 'เปิด' : 'ปิด'}</Pill>
          <div className="flex-1" />
          <Switch checked={eve.enabled} onChange={(v) => setEve({ enabled: v })} />
        </div>
        <div className="text-2xs text-mute">
          Eve เป็น AI ผู้ช่วยใน War Room — คุยกับ Eve ที่ dock มุมขวาล่าง หรือหน้า <code>/eve</code>
          {!paired && <> · <span className="text-warn">ยังไม่ paired</span> Eve จะใช้ regex ตอบแบบ demo</>}
        </div>
      </div>

      <div className="panel p-3 space-y-3">
        <div className="t-h">Provider</div>
        <div>
          <label className="text-2xs text-mute block mb-1">AI Provider</label>
          <select
            value={eve.provider}
            onChange={(e) => {
              const next = e.target.value;
              const prov = providers.find((p) => p.name === next);
              // Auto-pick the first model of the new provider so we don't leave
              // an invalid (provider, model) combo behind.
              setEve({
                provider: next,
                model: prov?.models[0]?.name ?? eve.model,
              });
            }}
            className="w-full px-2 py-1.5"
            disabled={!paired || loadingProviders}
          >
            {loadingProviders && <option>กำลังโหลด providers...</option>}
            {!loadingProviders && providers.length === 0 && (
              <>
                <option value="groq">groq (default — ไม่ได้ตรวจสอบ)</option>
                <option value="gemini">gemini</option>
                <option value="anthropic">anthropic</option>
                <option value="openai">openai</option>
                <option value="deepseek">deepseek</option>
              </>
            )}
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.display_name} ({p.name})
              </option>
            ))}
            {/* Fallback option if current provider isn't in the live list */}
            {eve.provider && !providers.find((p) => p.name === eve.provider) && (
              <option value={eve.provider}>{eve.provider} (custom)</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-2xs text-mute block mb-1">Model</label>
          {modelOptions.length > 0 ? (
            <select
              value={eve.model}
              onChange={(e) => setEve({ model: e.target.value })}
              className="w-full px-2 py-1.5"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.display_name ?? m.name}
                  {m.context_window ? ' · ' + m.context_window.toLocaleString() + ' ctx' : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={eve.model}
              onChange={(e) => setEve({ model: e.target.value.trim() })}
              placeholder="llama-3.3-70b-versatile"
              className="w-full px-2 py-1.5"
            />
          )}
          <div className="text-2xs text-mute mt-1">
            แนะนำ: <code>llama-3.3-70b-versatile</code> (groq) · <code>gemini-2.0-flash-exp</code> (gemini) · <code>claude-3-haiku-20240307</code> (anthropic)
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs text-mute block mb-1">
              Temperature <span className="mono text-fg">{eve.temperature.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={eve.temperature}
              onChange={(e) => setEve({ temperature: Number(e.target.value) })}
              className="w-full"
            />
            <div className="text-2xs text-mute">0 = ตอบตรงตัว · 1.5 = สร้างสรรค์</div>
          </div>
          <div>
            <label className="text-2xs text-mute block mb-1">
              Max tokens <span className="mono text-fg">{eve.maxTokens}</span>
            </label>
            <input
              type="number"
              min={64}
              max={1024}
              step={32}
              value={eve.maxTokens}
              onChange={(e) => setEve({ maxTokens: Math.max(64, Math.min(1024, Number(e.target.value) || 320)) })}
              className="w-full px-2 py-1"
            />
            <div className="text-2xs text-mute">320 = พอดี · มากกว่านี้ Eve จะตอบยาวขึ้น</div>
          </div>
        </div>

        <label className="flex items-center gap-2 pt-1">
          <Switch checked={eve.passContext} onChange={(v) => setEve({ passContext: v })} />
          <div>
            <div className="text-fg">ส่ง context warroom ให้ Eve</div>
            <div className="text-2xs text-mute">ให้ Eve รู้สถานะคิว/บิล/บอท ปัจจุบัน — Eve จะอ้างถึงตัวเลขจริงได้</div>
          </div>
        </label>
      </div>

      <div className="panel p-3 space-y-2">
        <div className="t-h">ทดสอบ Eve</div>
        <textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 resize-none"
          placeholder="ลองถาม Eve..."
        />
        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={() => void runTest()}
            disabled={testRunning || !paired || !testPrompt.trim()}
          >
            {testRunning ? '⏳ กำลังถาม...' : '▶ ทดสอบ'}
          </button>
          {!paired && <span className="text-2xs text-mute">ต้อง paired ก่อนถึงทดสอบจริงได้</span>}
        </div>
        {testReply && (
          <div className={cn(
            'border rounded p-2 text-xs whitespace-pre-wrap',
            testReply.ok ? 'border-ok/30 bg-ok/5 text-fg' : 'border-crit/30 bg-crit/5 text-crit',
          )}>
            {testReply.text || '(ไม่มี reply)'}
            {testReply.ok && testReply.latency !== undefined && (
              <div className="text-2xs text-mute mt-1 mono">
                {testReply.latency}ms · {testReply.tokens ?? '?'} tokens · {eve.provider}/{eve.model}
              </div>
            )}
          </div>
        )}
      </div>

      <EveVoicePanel />
      <EveSafetyPanel />
      <EveActionsHelpPanel />

      <div className="text-2xs text-mute">
        💡 เปลี่ยน provider แล้วกดทดสอบเพื่อดูว่าตอบไหวก่อนใช้จริง · settings ถูก persist อัตโนมัติทุก keystroke
      </div>
    </div>
  );
}

// ---------- Sub-panel: Eve voice (mic + TTS) ----------

function EveVoicePanel() {
  const voice = useSettings((s) => s.eve.voice);
  const setEveListen = useSettings((s) => s.setEveListen);
  const setEveSpeak = useSettings((s) => s.setEveSpeak);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const micSupported = useMemo(() => isSpeechRecognitionSupported(), []);
  const ttsSupported = useMemo(() => isSpeechSynthesisSupported(), []);

  useEffect(() => {
    if (!ttsSupported) return;
    void getVoices().then(setVoices);
  }, [ttsSupported]);

  const thaiVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith('th'));
  const otherVoices = voices.filter((v) => !v.lang?.toLowerCase().startsWith('th'));

  const sample = () => {
    if (!ttsSupported) {
      alert('เบราว์เซอร์นี้ไม่รองรับ SpeechSynthesis');
      return;
    }
    ttsSpeak('สวัสดีค่ะ พี่ — ทดสอบเสียง Eve นะคะ ถ้าได้ยินชัดแสดงว่าตั้งค่าเสียงพร้อมแล้วค่ะ', {
      voiceName: voice.speak.voiceName,
      rate: voice.speak.rate,
      pitch: voice.speak.pitch,
      volume: voice.speak.volume,
      interruptOnNew: true,
    });
  };

  return (
    <>
      {/* ── Voice input (mic) ────────────────────────────────────────── */}
      <div className="panel p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="t-h">ฟังเสียงสั่ง (Mic)</span>
          <Pill tone={voice.listen.enabled ? 'mystic' : 'dim'}>
            {voice.listen.enabled ? 'เปิด' : 'ปิด'}
          </Pill>
          <div className="flex-1" />
          <Switch
            checked={voice.listen.enabled}
            onChange={(v) => setEveListen({ enabled: v })}
          />
        </div>

        {!micSupported && (
          <div className="text-2xs text-warn">
            ⚠ เบราว์เซอร์นี้ไม่รองรับ SpeechRecognition — ใช้ Chrome/Edge บน Windows/macOS หรือ Safari 14.1+
          </div>
        )}

        <div>
          <label className="text-2xs text-mute block mb-1">ภาษา</label>
          <select
            value={voice.listen.lang}
            onChange={(e) => setEveListen({ lang: e.target.value })}
            className="w-full px-2 py-1.5"
            disabled={!voice.listen.enabled}
          >
            <option value="th-TH">ไทย (th-TH)</option>
            <option value="en-US">English US (en-US)</option>
            <option value="en-GB">English UK (en-GB)</option>
          </select>
        </div>

        <label className="flex items-center gap-2">
          <Switch
            checked={voice.listen.continuous}
            onChange={(v) => setEveListen({ continuous: v })}
            disabled={!voice.listen.enabled}
          />
          <div>
            <div className="text-fg">โหมดฟังต่อเนื่อง</div>
            <div className="text-2xs text-mute">
              เปิดไว้ = mic ค้างเปิด คลิกอีกครั้งเพื่อหยุด · ปิด = pushtotalk (พูดจบแล้ว mic ปิดเอง)
            </div>
          </div>
        </label>

        <label className="flex items-center gap-2">
          <Switch
            checked={voice.listen.autoSendOnFinal}
            onChange={(v) => setEveListen({ autoSendOnFinal: v })}
            disabled={!voice.listen.enabled}
          />
          <div>
            <div className="text-fg">ส่งทันทีเมื่อพูดจบ</div>
            <div className="text-2xs text-mute">
              ปิด = แค่เอา transcript ใส่ช่องพิมพ์ ให้พี่กด Enter เอง
            </div>
          </div>
        </label>
      </div>

      {/* ── Voice output (TTS) ───────────────────────────────────────── */}
      <div className="panel p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="t-h">พูดตอบ (TTS)</span>
          <Pill tone={voice.speak.enabled ? 'mystic' : 'dim'}>
            {voice.speak.enabled ? 'เปิด' : 'ปิด'}
          </Pill>
          <div className="flex-1" />
          <Switch
            checked={voice.speak.enabled}
            onChange={(v) => setEveSpeak({ enabled: v })}
          />
        </div>

        {!ttsSupported && (
          <div className="text-2xs text-warn">
            ⚠ เบราว์เซอร์นี้ไม่รองรับ SpeechSynthesis
          </div>
        )}

        <div>
          <label className="text-2xs text-mute block mb-1">เสียง</label>
          <select
            value={voice.speak.voiceName ?? ''}
            onChange={(e) => setEveSpeak({ voiceName: e.target.value || null })}
            className="w-full px-2 py-1.5"
            disabled={!voice.speak.enabled}
          >
            <option value="">เลือกอัตโนมัติ (Thai voice ที่ดีที่สุด)</option>
            {thaiVoices.length > 0 && (
              <optgroup label="ภาษาไทย">
                {thaiVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </optgroup>
            )}
            {otherVoices.length > 0 && (
              <optgroup label="ภาษาอื่น">
                {otherVoices.slice(0, 30).map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {voices.length === 0 && ttsSupported && (
            <div className="text-2xs text-mute mt-1">กำลังโหลดรายชื่อเสียง...</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-2xs text-mute block mb-1">
              ความเร็ว <span className="mono text-fg">{voice.speak.rate.toFixed(2)}x</span>
            </label>
            <input
              type="range" min={0.5} max={2.0} step={0.05}
              value={voice.speak.rate}
              onChange={(e) => setEveSpeak({ rate: Number(e.target.value) })}
              disabled={!voice.speak.enabled}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-2xs text-mute block mb-1">
              เสียงสูงต่ำ <span className="mono text-fg">{voice.speak.pitch.toFixed(2)}</span>
            </label>
            <input
              type="range" min={0} max={2} step={0.1}
              value={voice.speak.pitch}
              onChange={(e) => setEveSpeak({ pitch: Number(e.target.value) })}
              disabled={!voice.speak.enabled}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-2xs text-mute block mb-1">
              ความดัง <span className="mono text-fg">{Math.round(voice.speak.volume * 100)}%</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={voice.speak.volume}
              onChange={(e) => setEveSpeak({ volume: Number(e.target.value) })}
              disabled={!voice.speak.enabled}
              className="w-full"
            />
          </div>
        </div>

        <label className="flex items-center gap-2">
          <Switch
            checked={voice.speak.interruptOnNew}
            onChange={(v) => setEveSpeak({ interruptOnNew: v })}
            disabled={!voice.speak.enabled}
          />
          <div>
            <div className="text-fg">ตัดเสียงเก่าเมื่อมีคำตอบใหม่</div>
            <div className="text-2xs text-mute">ป้องกัน Eve พูดทับเสียงตัวเอง</div>
          </div>
        </label>

        <div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={sample}
            disabled={!voice.speak.enabled || !ttsSupported}
          >
            ▶ ทดสอบเสียง
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- Sub-panel: Eve safety guard rails ----------

function EveSafetyPanel() {
  const safety = useSettings((s) => s.eve.safety);
  const setEveSafety = useSettings((s) => s.setEveSafety);

  return (
    <div className="panel p-3 space-y-3">
      <div className="t-h">ความปลอดภัย</div>

      <label className="flex items-center gap-2">
        <Switch
          checked={safety.confirmDestructive}
          onChange={(v) => setEveSafety({ confirmDestructive: v })}
        />
        <div>
          <div className="text-fg">ยืนยันก่อนทำคำสั่งเสี่ยง</div>
          <div className="text-2xs text-mute">
            อนุมัติถอน / refund / cancel / ban — Eve จะ "เสนอ" ผ่าน toast แทนการลงมือเอง (แนะนำให้เปิดไว้)
          </div>
        </div>
      </label>

      <label className="flex items-center gap-2">
        <Switch
          checked={safety.allowAutonomousNavigate}
          onChange={(v) => setEveSafety({ allowAutonomousNavigate: v })}
        />
        <div>
          <div className="text-fg">อนุญาตให้ Eve นำทางเอง</div>
          <div className="text-2xs text-mute">
            ปิด = Eve เสนอผ่าน toast แทนการกระโดดหน้าเอง · เปิด = สั่ง "เปิดหน้าบิล" แล้วไปทันที
          </div>
        </div>
      </label>
    </div>
  );
}

// ---------- Sub-panel: action vocabulary (read-only help) ----------

function EveActionsHelpPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel p-3">
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="t-h">คำสั่งที่ Eve เข้าใจ</span>
        <span className="text-2xs text-mute">({ACTION_VOCABULARY.length})</span>
        <div className="flex-1" />
        <span className="text-mute text-2xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-2xs">
          {ACTION_VOCABULARY.map((a) => (
            <div key={a.tag} className="flex items-start gap-2 leading-relaxed">
              <code className={cn(
                'mono px-1.5 py-0.5 rounded shrink-0',
                a.destructive ? 'bg-warn/15 text-warn' : 'bg-info/10 text-info',
              )}>
                {a.syntax}
              </code>
              <span className="text-mute">{a.description}</span>
            </div>
          ))}
          <div className="text-2xs text-mute mt-2 pt-2 border-t border-line">
            💡 ลองพูด/พิมพ์: <i>"เปิดหน้าบิล"</i> · <i>"รีเฟรช"</i> · <i>"แช่แข็ง"</i> · <i>"ลูกค้า 42"</i> ·{' '}
            <i>"เคส r-1234"</i>
          </div>
        </div>
      )}
    </div>
  );
}

function SlaTab() {
  const sla = useSettings((s) => s.sla);
  const setSla = useSettings((s) => s.setSla);

  const fields: { k: keyof typeof sla; label: string }[] = [
    { k: 'reading', label: 'คำทำนายค้าง' },
    { k: 'celtic', label: 'Celtic Cross' },
    { k: 'payment', label: 'ยอดโอนไม่ตรง' },
    { k: 'sensitive', label: 'เคสอ่อนไหว (mood ≥ 4)' },
  ];

  return (
    <section>
      <div className="t-h mb-2">เกณฑ์ SLA (นาที)</div>
      <p className="text-mute mb-3">
        เคสจะถูกยกเป็น <span className="text-warn">เตือน</span> เมื่อใกล้ครบเวลา และ{' '}
        <span className="text-crit">วิกฤต</span> เมื่อเกินเกณฑ์
      </p>
      <div className="space-y-2">
        {fields.map(({ k, label }) => (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 text-fg">{label}</span>
            <input
              type="number"
              min={1}
              max={240}
              value={sla[k]}
              onChange={(e) => setSla({ [k]: Math.max(1, Number(e.target.value) || 1) })}
              className="w-20 px-2 py-1 text-xs mono"
            />
            <span className="text-mute w-12">นาที</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Tab: Notifications ----------

function NotifTab() {
  const n = useSettings((s) => s.notifications);
  const setN = useSettings((s) => s.setNotifications);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function ensureDesktop(v: boolean) {
    if (!v) {
      setN({ desktopNotification: false });
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('เบราว์เซอร์นี้ไม่รองรับ desktop notification');
      return;
    }
    if (Notification.permission === 'granted') {
      setN({ desktopNotification: true });
      return;
    }
    const r = await Notification.requestPermission();
    setPermission(r);
    if (r === 'granted') setN({ desktopNotification: true });
    else alert('ผู้ใช้ปฏิเสธสิทธิ์ desktop notification');
  }

  return (
    <section>
      <div className="t-h mb-2">กฎแจ้งเตือน</div>
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Switch checked={n.soundOnCritical} onChange={(v) => setN({ soundOnCritical: v })} />
          <span className="text-fg">เด้งเสียงเมื่อเคสวิกฤต</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={n.desktopNotification} onChange={ensureDesktop} />
          <span className="text-fg">Desktop notification</span>
          {permission === 'denied' && (
            <Pill tone="crit" className="ml-1">
              ถูกปฏิเสธ
            </Pill>
          )}
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={n.mood5Instant} onChange={(v) => setN({ mood5Instant: v })} />
          <span className="text-fg">แจ้งเตือนเคส mood 5 ทันที</span>
        </label>
      </div>
    </section>
  );
}

// ---------- Tab: Sound ----------

function SoundTab() {
  const sound = useSettings((s) => s.sound);
  const setSound = useSettings((s) => s.setSound);

  const profiles: { k: SoundProfile; label: string }[] = [
    { k: 'bridge', label: 'Bridge — สั้น สุภาพ' },
    { k: 'submarine', label: 'Submarine — ดัง กระชับ' },
    { k: 'cathedral', label: 'Cathedral — หรูหรา' },
  ];

  function preview() {
    try {
      // simple AudioContext beep — actual SFX would live in /public/assets/sfx/
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = sound.profile === 'bridge' ? 880 : sound.profile === 'submarine' ? 440 : 660;
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = (sound.volume / 100) * 0.2;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      /* no-op */
    }
  }

  return (
    <section>
      <div className="t-h mb-2">เสียงแจ้งเตือน</div>
      <select
        value={sound.profile}
        onChange={(e) => setSound({ profile: e.target.value as SoundProfile })}
        className="w-full px-2 py-1.5 text-xs"
      >
        {profiles.map((p) => (
          <option key={p.k} value={p.k}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-dim">ระดับเสียง</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sound.volume}
          onChange={(e) => setSound({ volume: Number(e.target.value) })}
          className="flex-1"
        />
        <span className="mono text-fg w-10 text-right">{sound.volume}%</span>
      </div>
      <button onClick={preview} className="btn btn-info mt-3">
        <Volume2 size={12} /> ทดลองเสียง
      </button>
    </section>
  );
}

// ---------- Tab: Layout ----------

function LayoutTab() {
  const layout = useSettings((s) => s.layout);
  const setLayout = useSettings((s) => s.setLayout);
  const settingsRefresh = useSettings((s) => s.refreshInterval);
  const setSettingsRefresh = useSettings((s) => s.setRefreshInterval);
  const setWarroomRefresh = useWarroom((s) => s.setRefreshInterval);

  const options: { k: LayoutMode; label: string }[] = [
    { k: '3col', label: '3 คอลัมน์' },
    { k: '2col', label: '2 คอลัมน์' },
    { k: 'compact', label: 'คอมแพ็ค' },
  ];

  function changeRefresh(v: RefreshInterval) {
    setSettingsRefresh(v);
    setWarroomRefresh(v);
  }

  return (
    <section className="space-y-4">
      <div>
        <div className="t-h mb-2">เลย์เอาต์</div>
        <div className="grid grid-cols-3 gap-2">
          {options.map((opt) => (
            <button
              key={opt.k}
              onClick={() => setLayout(opt.k)}
              className={
                layout === opt.k
                  ? 'aspect-video rounded border border-info bg-info/10 grid place-items-center text-xs text-info'
                  : 'aspect-video rounded border border-line bg-panel2 grid place-items-center text-xs text-mute hover:text-fg'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="t-h mb-2">ช่วงรีเฟรช</div>
        <div className="grid grid-cols-4 gap-2">
          {([2, 5, 10, 30] as RefreshInterval[]).map((v) => (
            <button
              key={v}
              onClick={() => changeRefresh(v)}
              className={
                settingsRefresh === v
                  ? 'h-9 rounded border border-info bg-info/10 text-info text-xs mono'
                  : 'h-9 rounded border border-line bg-panel2 text-mute text-xs mono hover:text-fg'
              }
            >
              {v} วิ
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Tab: Shift ----------

function ShiftTab() {
  const shift = useSettings((s) => s.shift);
  const setShift = useSettings((s) => s.setShift);

  return (
    <section>
      <div className="t-h mb-2">Shift handover</div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-dim mb-1">เริ่มกะ</div>
            <input
              type="time"
              value={shift.startAt}
              onChange={(e) => setShift({ startAt: e.target.value })}
              className="w-full px-2 py-1.5 text-xs mono"
            />
          </label>
          <label className="block">
            <div className="text-dim mb-1">จบกะ</div>
            <input
              type="time"
              value={shift.endAt}
              onChange={(e) => setShift({ endAt: e.target.value })}
              className="w-full px-2 py-1.5 text-xs mono"
            />
          </label>
        </div>
        <label className="block">
          <div className="text-dim mb-1">รับช่วงต่อจาก</div>
          <input
            type="text"
            value={shift.takeoverFrom}
            onChange={(e) => setShift({ takeoverFrom: e.target.value })}
            className="w-full px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block">
          <div className="text-dim mb-1">ส่งต่อให้</div>
          <input
            type="text"
            value={shift.handoverTo}
            onChange={(e) => setShift({ handoverTo: e.target.value })}
            className="w-full px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block">
          <div className="text-dim mb-1">ข้อความส่งกะ</div>
          <textarea
            value={shift.handoverNote}
            onChange={(e) => setShift({ handoverNote: e.target.value })}
            rows={4}
            className="w-full px-2 py-1.5 text-xs"
            placeholder="สรุปเคสค้าง · ลูกค้า VIP · ปัญหาที่ค้าง…"
          />
        </label>
      </div>
    </section>
  );
}

// ---------- Tab: Advanced ----------

function AdvancedTab() {
  const resetAll = useSettings((s) => s.resetAll);

  function onExport() {
    const state = useSettings.getState();
    // strip token before exporting
    const safe = {
      ...state,
      connection: { ...state.connection, token: '', user: null, status: 'idle', lastError: null, lastCheckAt: null },
    };
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warroom-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onReset() {
    if (!confirm('รีเซ็ตทุกค่ารวมถึง Token? การกระทำนี้ย้อนกลับไม่ได้')) return;
    resetAll();
    alert('รีเซ็ตเรียบร้อย — โหลดหน้าใหม่ให้เรียบร้อย');
  }

  return (
    <section className="space-y-3">
      <div className="t-h mb-1">ขั้นสูง</div>
      <p className="text-mute">
        การตั้งค่าทั้งหมดเก็บใน localStorage ของเบราว์เซอร์ (key:{' '}
        <code className="mono text-fg">warroom-settings.v1</code>)
      </p>

      <button onClick={onExport} className="btn btn-ghost w-full justify-center">
        ส่งออกการตั้งค่า (ไม่รวม Token)
      </button>

      <button onClick={onReset} className="btn btn-crit w-full justify-center">
        <Trash2 size={12} />
        รีเซ็ตทุกอย่าง
      </button>
    </section>
  );
}
