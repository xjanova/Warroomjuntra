'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ConnectionStatus = 'idle' | 'testing' | 'paired' | 'error';

export type LayoutMode = '3col' | '2col' | 'compact';

export type SoundProfile = 'bridge' | 'submarine' | 'cathedral';

export type RefreshInterval = 2 | 5 | 10 | 30;

export type PairedUser = {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
};

export type SlaThresholds = {
  reading: number;       // คำทำนายค้าง (นาที)
  celtic: number;        // Celtic Cross (นาที)
  payment: number;       // ยอดโอนไม่ตรง (นาที)
  sensitive: number;     // เคสอ่อนไหว mood ≥ 4 (นาที)
};

export type NotificationRules = {
  soundOnCritical: boolean;
  desktopNotification: boolean;
  mood5Instant: boolean;
};

export type SoundConfig = {
  profile: SoundProfile;
  volume: number;        // 0..100
};

export type ConnectionConfig = {
  baseUrl: string;       // e.g. https://จันทรา.online/api
  token: string;         // Sanctum personal access token
  user: PairedUser | null;
  status: ConnectionStatus;
  lastError: string | null;
  lastCheckAt: number | null;
};

export type ShiftConfig = {
  startAt: string;       // "14:00"
  endAt: string;         // "22:00"
  takeoverFrom: string;  // "แอน (07:00)"
  handoverTo: string;    // "นัท (22:00)"
  handoverNote: string;
};

export type EveVoiceListen = {
  enabled: boolean;        // mic on at all
  lang: string;            // 'th-TH' | 'en-US' | ...
  continuous: boolean;     // true = always-listening mode (click to start, click to stop); false = push-to-talk only
  autoSendOnFinal: boolean;// auto-submit when SpeechRecognition emits final transcript
};

export type EveVoiceSpeak = {
  enabled: boolean;        // Eve speaks her replies via TTS
  voiceName: string | null;// browser voice; null = pick best Thai voice automatically
  rate: number;            // 0.5..2.0 — playback speed
  pitch: number;           // 0..2.0
  volume: number;          // 0..1
  interruptOnNew: boolean; // cancel current utterance when a new reply arrives
};

export type EveSafetyConfig = {
  confirmDestructive: boolean; // legacy — superseded by autoManage (kept for migrate compat)
  allowAutonomousNavigate: boolean; // false = even GOTO needs operator click; true = execute immediately
  // 🤖 (2026-06-04) The two operating modes for Eve's management tools:
  //   true  = "จัดการเอง" — Eve runs approve/refund/cancel/ban/mark-paid/toggle
  //           directly the moment she decides.
  //   false = "ขออนุญาต" — Eve queues each action as a confirmation card and waits
  //           for the operator to press ยืนยัน. Default false (safer).
  autoManage: boolean;
};

export type EveConfig = {
  provider: string;      // e.g. 'groq' | 'gemini' | 'anthropic' | 'openai' | 'deepseek' | 'qwen'
  model: string;         // e.g. 'llama-3.3-70b-versatile'
  temperature: number;   // 0..2
  maxTokens: number;     // 64..1024
  enabled: boolean;      // master switch for Eve dock
  passContext: boolean;  // include warroom state hint in /eve/chat body
  voice: {
    listen: EveVoiceListen;
    speak: EveVoiceSpeak;
  };
  safety: EveSafetyConfig;
};

type SettingsState = {
  connection: ConnectionConfig;
  sla: SlaThresholds;
  notifications: NotificationRules;
  sound: SoundConfig;
  layout: LayoutMode;
  refreshInterval: RefreshInterval;
  shift: ShiftConfig;
  eve: EveConfig;

  // connection actions
  setBaseUrl: (url: string) => void;
  setToken: (token: string) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  setPairedUser: (user: PairedUser | null) => void;
  markChecked: () => void;
  disconnect: () => void;

  // other actions
  setSla: (patch: Partial<SlaThresholds>) => void;
  setNotifications: (patch: Partial<NotificationRules>) => void;
  setSound: (patch: Partial<SoundConfig>) => void;
  setLayout: (v: LayoutMode) => void;
  setRefreshInterval: (v: RefreshInterval) => void;
  setShift: (patch: Partial<ShiftConfig>) => void;
  setEve: (patch: Partial<EveConfig>) => void;
  setEveListen: (patch: Partial<EveVoiceListen>) => void;
  setEveSpeak: (patch: Partial<EveVoiceSpeak>) => void;
  setEveSafety: (patch: Partial<EveSafetyConfig>) => void;

  resetAll: () => void;
};

const DEFAULT_SLA: SlaThresholds = {
  reading: 5,
  celtic: 30,
  payment: 10,
  sensitive: 3,
};

const DEFAULT_NOTIFICATIONS: NotificationRules = {
  soundOnCritical: true,
  desktopNotification: true,
  mood5Instant: false,
};

const DEFAULT_SOUND: SoundConfig = {
  profile: 'bridge',
  volume: 60,
};

const DEFAULT_CONNECTION: ConnectionConfig = {
  baseUrl: '',
  token: '',
  user: null,
  status: 'idle',
  lastError: null,
  lastCheckAt: null,
};

const DEFAULT_SHIFT: ShiftConfig = {
  startAt: '14:00',
  endAt: '22:00',
  takeoverFrom: 'แอน (07:00)',
  handoverTo: 'นัท (22:00)',
  handoverNote: '',
};

const DEFAULT_EVE: EveConfig = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  temperature: 0.55,
  maxTokens: 320,
  enabled: true,
  passContext: true,
  voice: {
    listen: {
      enabled: false,
      lang: 'th-TH',
      continuous: false,
      autoSendOnFinal: true,
    },
    speak: {
      // Default OFF — operator opts in via Settings. But the cute preset is
      // applied on first enable: pitch 1.3 + rate 1.05 → young-girl feel.
      enabled: false,
      voiceName: null,    // auto-pick best Thai female voice
      rate: 1.05,
      pitch: 1.30,
      volume: 1.0,
      interruptOnNew: true,
    },
  },
  safety: {
    confirmDestructive: true,
    allowAutonomousNavigate: true,
    autoManage: false, // ask-permission by default
  },
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      connection: DEFAULT_CONNECTION,
      sla: DEFAULT_SLA,
      notifications: DEFAULT_NOTIFICATIONS,
      sound: DEFAULT_SOUND,
      layout: '3col',
      refreshInterval: 5,
      shift: DEFAULT_SHIFT,
      eve: DEFAULT_EVE,

      setBaseUrl: (url) =>
        set((s) => ({
          connection: {
            ...s.connection,
            baseUrl: url.trim().replace(/\/+$/, ''),
            // changing URL invalidates current paired state
            status: s.connection.status === 'paired' ? 'idle' : s.connection.status,
            user: s.connection.baseUrl === url ? s.connection.user : null,
          },
        })),

      setToken: (token) =>
        set((s) => ({
          connection: {
            ...s.connection,
            token: token.trim(),
            status: s.connection.status === 'paired' ? 'idle' : s.connection.status,
            user: s.connection.token === token ? s.connection.user : null,
          },
        })),

      setConnectionStatus: (status, error = null) =>
        set((s) => ({
          connection: { ...s.connection, status, lastError: error },
        })),

      setPairedUser: (user) =>
        set((s) => ({
          connection: { ...s.connection, user },
        })),

      markChecked: () =>
        set((s) => ({
          connection: { ...s.connection, lastCheckAt: Date.now() },
        })),

      disconnect: () =>
        set((s) => ({
          connection: {
            ...s.connection,
            token: '',
            user: null,
            status: 'idle',
            lastError: null,
          },
        })),

      setSla: (patch) => set((s) => ({ sla: { ...s.sla, ...patch } })),
      setNotifications: (patch) =>
        set((s) => ({ notifications: { ...s.notifications, ...patch } })),
      setSound: (patch) => set((s) => ({ sound: { ...s.sound, ...patch } })),
      setLayout: (v) => set({ layout: v }),
      setRefreshInterval: (v) => set({ refreshInterval: v }),
      setShift: (patch) => set((s) => ({ shift: { ...s.shift, ...patch } })),
      setEve: (patch) => set((s) => ({ eve: { ...s.eve, ...patch } })),

      setEveListen: (patch) =>
        set((s) => ({
          eve: {
            ...s.eve,
            voice: {
              ...s.eve.voice,
              listen: { ...s.eve.voice.listen, ...patch },
            },
          },
        })),

      setEveSpeak: (patch) =>
        set((s) => ({
          eve: {
            ...s.eve,
            voice: {
              ...s.eve.voice,
              speak: { ...s.eve.voice.speak, ...patch },
            },
          },
        })),

      setEveSafety: (patch) =>
        set((s) => ({
          eve: { ...s.eve, safety: { ...s.eve.safety, ...patch } },
        })),

      resetAll: () =>
        set({
          connection: DEFAULT_CONNECTION,
          sla: DEFAULT_SLA,
          notifications: DEFAULT_NOTIFICATIONS,
          sound: DEFAULT_SOUND,
          layout: '3col',
          refreshInterval: 5,
          shift: DEFAULT_SHIFT,
          eve: DEFAULT_EVE,
        }),
    }),
    {
      name: 'warroom-settings.v1',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      // v1 predates eve.voice/eve.safety; v3 adds eve.safety.autoManage. Normalize
      // the eve config against current defaults so older payloads never leave a
      // nested field undefined (EveChatBody/actions read safety.autoManage etc.).
      migrate: (persisted, fromVersion) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        if (fromVersion < 3 && p.eve) {
          const e = p.eve as Partial<EveConfig>;
          p.eve = {
            ...DEFAULT_EVE,
            ...e,
            voice: {
              listen: { ...DEFAULT_EVE.voice.listen, ...(e.voice?.listen ?? {}) },
              speak: { ...DEFAULT_EVE.voice.speak, ...(e.voice?.speak ?? {}) },
            },
            safety: { ...DEFAULT_EVE.safety, ...(e.safety ?? {}) },
          };
        }
        return p as SettingsState;
      },
      // re-hydrating an in-flight 'testing' status would lie about reality
      partialize: (state) => ({
        connection: {
          ...state.connection,
          status: state.connection.status === 'testing' ? 'idle' : state.connection.status,
        },
        sla: state.sla,
        notifications: state.notifications,
        sound: state.sound,
        layout: state.layout,
        refreshInterval: state.refreshInterval,
        shift: state.shift,
        eve: state.eve,
      }),
    }
  )
);

export function isPaired(s: SettingsState): boolean {
  return (
    s.connection.status === 'paired' &&
    !!s.connection.token &&
    !!s.connection.baseUrl
  );
}

/**
 * Derive the Laravel admin-web URL (the operator panel) from the configured
 * API base URL. The API base is stored as `https://host/api/admin`; the web
 * panel lives at `https://host/admin`. Several warroom actions (credit adjust,
 * refunds, broadcast, account flags) have no warroom-scoped API endpoint and
 * deep-link into the admin web instead — this keeps that host in one place
 * rather than hardcoding `main.thaiprompt.online` at every call site.
 *
 * Reads the live store, so call it from event handlers (not render).
 */
export function adminWebUrl(path = ''): string {
  const base = useSettings.getState().connection.baseUrl;
  let origin = 'https://main.thaiprompt.online';
  if (base) {
    try {
      origin = new URL(base).origin;
    } catch {
      /* malformed base — keep production fallback */
    }
  }
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${origin}/admin${p}`;
}
