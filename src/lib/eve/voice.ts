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
 * Pick the best Thai voice from the cached list. Prefers female-sounding
 * names ("Kanya", "Premwadee", "Narisa") common across iOS/macOS/Chrome.
 * Falls back to the first th-TH voice, then null.
 */
export function pickBestThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const thai = voices.filter((v) => v.lang?.toLowerCase().startsWith('th'));
  if (thai.length === 0) return null;
  const femaleHints = ['kanya', 'premwadee', 'narisa', 'siri', 'female'];
  for (const hint of femaleHints) {
    const match = thai.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return thai[0] ?? null;
}

/**
 * Speak `text` via SpeechSynthesis. Returns a handle to cancel.
 *
 * If `interruptOnNew` is true (default), any in-flight utterance is cancelled
 * first — this is what you want for chat replies (don't queue up old context).
 */
export function speak(text: string, opts: SpeakOptions = {}): { cancel: () => void } | null {
  if (!isSpeechSynthesisSupported()) {
    opts.onError?.('SpeechSynthesis not supported');
    return null;
  }
  const clean = text.replace(/<[^>]+>/g, '').trim();
  if (!clean) return null;

  if (opts.interruptOnNew !== false) {
    window.speechSynthesis.cancel();
  }

  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = opts.lang ?? 'th-TH';
  utter.rate = clamp(opts.rate ?? 1.0, 0.5, 2.0);
  utter.pitch = clamp(opts.pitch ?? 1.0, 0, 2);
  utter.volume = clamp(opts.volume ?? 1.0, 0, 1);

  // Voice lookup. Use the cache if populated; otherwise fall back to inline
  // getVoices() (sync — may return empty on first call).
  const voices = voicesCache ?? (typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : []);
  const matched = opts.voiceName
    ? voices.find((v) => v.name === opts.voiceName) ?? null
    : pickBestThaiVoice(voices);
  if (matched) utter.voice = matched;

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
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
