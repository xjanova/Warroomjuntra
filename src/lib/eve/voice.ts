'use client';

// Web Speech API wrappers — SpeechRecognition (mic) + SpeechSynthesis (TTS).
// Browser-native, no API key, no network. Thai-first (th-TH) but lang-configurable.
// SSR-safe: every browser API access is guarded by `typeof window !== 'undefined'`.

// ── Type shims ──────────────────────────────────────────────────────────────
// TypeScript's lib.dom.d.ts only ships SpeechRecognition in some versions; we
// declare what we need so the file compiles regardless of target lib version.

type RecognitionResult = {
  transcript: string;
  isFinal: boolean;
  confidence: number;
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<RecognitionResult> & { isFinal: boolean }>;
};

type RecognitionErrorEvent = {
  error: string;
  message?: string;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: RecognitionEvent) => void) | null;
  onerror: ((ev: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ── Recognition (mic) ───────────────────────────────────────────────────────

export type ListenOptions = {
  lang?: string;            // 'th-TH' default
  continuous?: boolean;     // true = keep mic open (lock-on); false = stop after one utterance
  interim?: boolean;        // true = emit partial transcripts as they arrive
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (kind: string, message?: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
};

export type ListenHandle = {
  stop: () => void;       // graceful — current utterance is delivered first
  abort: () => void;      // hard cancel — discard current utterance
  isActive: () => boolean;
};

/**
 * Start the browser's speech recognition. Returns a handle to stop/abort.
 * Returns null if the browser doesn't support SpeechRecognition (Safari < 14.1, etc.).
 *
 * Caller is responsible for stopping when the user clicks the mic again or
 * navigates away. Otherwise the mic stays hot.
 */
export function startListening(opts: ListenOptions): ListenHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    opts.onError?.('unsupported', 'Browser does not support SpeechRecognition');
    return null;
  }

  const rec = new Ctor();
  rec.lang = opts.lang ?? 'th-TH';
  rec.continuous = opts.continuous ?? false;
  rec.interimResults = opts.interim ?? true;
  rec.maxAlternatives = 1;

  let active = true;

  rec.onstart = () => opts.onStart?.();

  rec.onresult = (ev) => {
    // Walk the new results since `ev.resultIndex`. Each entry is an array of
    // alternatives; we take the first alternative. Partial vs final is on the
    // entry, not the alternative.
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const entry = ev.results[i] as ArrayLike<RecognitionResult> & { isFinal: boolean };
      const alt = entry[0];
      if (!alt) continue;
      const text = (alt.transcript ?? '').trim();
      if (!text) continue;
      if (entry.isFinal) {
        opts.onFinal(text);
      } else {
        opts.onPartial?.(text);
      }
    }
  };

  rec.onerror = (ev) => {
    // Common errors: 'no-speech', 'aborted', 'audio-capture', 'not-allowed', 'network'
    // 'aborted' fires whenever we call abort() — not an error worth surfacing.
    if (ev.error === 'aborted') return;
    opts.onError?.(ev.error, ev.message);
  };

  rec.onend = () => {
    active = false;
    opts.onEnd?.();
  };

  try {
    rec.start();
  } catch (err) {
    // Calling start() while another recognition is already running throws.
    active = false;
    opts.onError?.('start-failed', String((err as Error).message ?? err));
    return null;
  }

  return {
    stop: () => {
      if (!active) return;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
    abort: () => {
      if (!active) return;
      try {
        rec.abort();
      } catch {
        /* already aborted */
      }
    },
    isActive: () => active,
  };
}

// ── Synthesis (TTS) ─────────────────────────────────────────────────────────

export type SpeakOptions = {
  lang?: string;            // 'th-TH' default; if voiceName is set, voice's lang wins
  voiceName?: string | null;// browser voice name; null = pick best Thai voice automatically
  rate?: number;            // 0.5..2.0
  pitch?: number;           // 0..2.0
  volume?: number;          // 0..1
  interruptOnNew?: boolean; // cancel current utterance before speaking
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
};

let voicesCache: SpeechSynthesisVoice[] | null = null;

/**
 * Returns the list of available voices. Some browsers populate the voice list
 * asynchronously, so this function waits up to 1.5s for `voiceschanged` to fire.
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }
    const initial = window.speechSynthesis.getVoices();
    if (initial.length > 0) {
      voicesCache = initial;
      resolve(initial);
      return;
    }
    // Wait for voiceschanged or time out.
    let done = false;
    const onChange = () => {
      if (done) return;
      done = true;
      voicesCache = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(voicesCache);
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    setTimeout(() => {
      if (done) return;
      done = true;
      voicesCache = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(voicesCache);
    }, 1500);
  });
}

/**
 * Pick the best Thai female voice — used for Eve's "cute young girl" default
 * persona. Ordered by perceived youthfulness/quality:
 *   1. Achara (MS Online Natural) — best free quality on Windows/Edge
 *   2. Premwadee (MS Online Natural) — also great, slightly more mature
 *   3. Kanya (macOS) — youthful tone
 *   4. Narisa (iOS) — fallback
 *   5. Any voice with "female" in the name
 *   6. Any th-TH voice (last resort — may be male)
 * Returns null if no Thai voice is installed.
 *
 * The "cute" feel ultimately comes from pitch + rate, not the voice list —
 * see DEFAULT_EVE.voice.speak for the recommended starting tuning.
 */
export function pickBestThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const thai = voices.filter((v) => v.lang?.toLowerCase().startsWith('th'));
  if (thai.length === 0) return null;
  // Explicitly skip Niwat (male) — only fall back to it if literally nothing else.
  const youthfulHints = ['achara', 'premwadee', 'kanya', 'narisa', 'siri'];
  for (const hint of youthfulHints) {
    const match = thai.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  // "female" / "ผู้หญิง" tags
  const femaleMatch = thai.find((v) => /female|ผู้หญิง|women/i.test(v.name));
  if (femaleMatch) return femaleMatch;
  // Any non-male th-TH voice
  const nonMale = thai.find((v) => !/niwat|male|ผู้ชาย|men/i.test(v.name));
  if (nonMale) return nonMale;
  return thai[0] ?? null;
}

/**
 * Pre-tuned voice personas. Apply these to `eve.voice.speak` via
 * Settings → Eve AI tab. The "cute" preset is what Eve uses by default.
 */
export const VOICE_PRESETS = {
  cute:        { rate: 1.05, pitch: 1.30, label: 'น่ารัก (เด็กสาว)' },
  cuter:       { rate: 1.10, pitch: 1.45, label: 'เด็กมาก (สดใส)' },
  polite:      { rate: 1.00, pitch: 1.05, label: 'สุภาพ (มาตรฐาน)' },
  authoritative: { rate: 0.95, pitch: 0.85, label: 'มีอำนาจ (เป็นทางการ)' },
  calm:        { rate: 0.90, pitch: 1.00, label: 'สงบ (ค่อยๆ พูด)' },
} as const;

export type VoicePresetKey = keyof typeof VOICE_PRESETS;

// ── Google Translate TTS fallback ───────────────────────────────────────────
// Most Windows Chrome installs ship ZERO Thai voices (only the 3 English
// Microsoft SAPI ones), so SpeechSynthesis silently mangles or skips Thai.
// Fallback: the free Google Translate voice — the same one Android users know.
// Caveats: ~200-char limit per request (we chunk), unofficial endpoint, and it
// 404s any request with a foreign Referer (app sets metadata.referrer
// 'no-referrer' in layout.tsx to strip it). pitch is not supported; rate maps
// to playbackRate.

type GoogleSpeechHandle = { cancelled: boolean; current: HTMLAudioElement | null };
let googleSpeechActive: GoogleSpeechHandle | null = null;

function googleTtsUrl(chunk: string, lang: string): string {
  const tl = (lang || 'th-TH').split('-')[0];
  return (
    'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
    encodeURIComponent(tl) +
    '&q=' +
    encodeURIComponent(chunk)
  );
}

/**
 * Split text into ≤maxLen chunks the TTS endpoint accepts. Thai rarely has
 * spaces, so prefer sentence-ish boundaries (punctuation / ค่ะ / ครับ / นะคะ),
 * then spaces, then hard-cut.
 */
export function chunkForTts(text: string, maxLen = 180): string[] {
  const out: string[] = [];
  let rest = text.trim();
  const BOUNDARY = /[.!?…ๆฯ\n]|ค่ะ|ครับ|นะคะ|นะคับ/g;
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen);
    let cut = -1;
    let m: RegExpExecArray | null;
    BOUNDARY.lastIndex = 0;
    while ((m = BOUNDARY.exec(window)) !== null) cut = m.index + m[0].length;
    if (cut < maxLen * 0.3) {
      const sp = window.lastIndexOf(' ');
      cut = sp > maxLen * 0.3 ? sp + 1 : maxLen;
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

function speakViaGoogleTts(text: string, opts: SpeakOptions): { cancel: () => void } {
  // Stop any previous Google playback (browser synthesis was cancelled by caller).
  if (googleSpeechActive) {
    googleSpeechActive.cancelled = true;
    googleSpeechActive.current?.pause();
  }
  const handle: GoogleSpeechHandle = { cancelled: false, current: null };
  googleSpeechActive = handle;

  const chunks = chunkForTts(text);
  const lang = opts.lang ?? 'th-TH';

  void (async () => {
    opts.onStart?.();
    for (const chunk of chunks) {
      if (handle.cancelled) return;
      const ok = await new Promise<boolean>((resolve) => {
        const audio = new Audio(googleTtsUrl(chunk, lang));
        handle.current = audio;
        audio.volume = clamp(opts.volume ?? 1.0, 0, 1);
        // No pitch control here — approximate the persona with rate only.
        audio.playbackRate = clamp(opts.rate ?? 1.0, 0.5, 2.0);
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.onpause = () => {
          // pause() from cancel — treat as finished so the loop exits.
          if (handle.cancelled) resolve(false);
        };
        audio.play().catch(() => resolve(false));
      });
      if (!ok) {
        if (!handle.cancelled) opts.onError?.('google-tts-failed');
        break;
      }
    }
    if (!handle.cancelled) opts.onEnd?.();
    if (googleSpeechActive === handle) googleSpeechActive = null;
  })();

  return {
    cancel: () => {
      handle.cancelled = true;
      handle.current?.pause();
      if (googleSpeechActive === handle) googleSpeechActive = null;
    },
  };
}

/**
 * Speak `text` — browser SpeechSynthesis when a matching (Thai) voice exists,
 * otherwise the free Google Translate voice. Returns a handle to cancel.
 *
 * If `interruptOnNew` is true (default), any in-flight utterance is cancelled
 * first — this is what you want for chat replies (don't queue up old context).
 */
export function speak(text: string, opts: SpeakOptions = {}): { cancel: () => void } | null {
  const clean = text.replace(/<[^>]+>/g, '').trim();
  if (!clean) return null;

  if (opts.interruptOnNew !== false) cancelSpeech();

  // Voice lookup. Use the cache if populated; otherwise fall back to inline
  // getVoices() (sync — may return empty on first call).
  const voices = isSpeechSynthesisSupported()
    ? voicesCache ?? window.speechSynthesis.getVoices()
    : [];
  const matched = opts.voiceName
    ? voices.find((v) => v.name === opts.voiceName) ?? pickBestThaiVoice(voices)
    : pickBestThaiVoice(voices);

  // No usable Thai voice on this machine (typical Windows Chrome: English-only
  // SAPI voices) → Google fallback so Eve actually speaks Thai.
  if (!matched || !isSpeechSynthesisSupported()) {
    return speakViaGoogleTts(clean, opts);
  }

  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = opts.lang ?? 'th-TH';
  utter.rate = clamp(opts.rate ?? 1.0, 0.5, 2.0);
  utter.pitch = clamp(opts.pitch ?? 1.0, 0, 2);
  utter.volume = clamp(opts.volume ?? 1.0, 0, 1);
  utter.voice = matched;

  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = (e) => opts.onError?.(e.error ?? 'speech-error');

  window.speechSynthesis.speak(utter);

  return {
    cancel: () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}

export function cancelSpeech() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (googleSpeechActive) {
    googleSpeechActive.cancelled = true;
    googleSpeechActive.current?.pause();
    googleSpeechActive = null;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
