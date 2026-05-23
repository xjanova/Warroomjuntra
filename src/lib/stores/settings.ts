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
  confirmDestructive: boolean; // Eve must propose (toast) instead of executing approve/reject/refund/cancel
  allowAutonomousNavigate: boolean; // false = even GOTO needs operator click; true = execute immediately
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
      enabled: false,
      voiceName: null,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      interruptOnNew: true,
    },
  },
  safety: {
    confirmDestructive: true,
    allowAutonomousNavigate: true,
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
      version: 2,
      // Old v1 payloads predate eve.voice / eve.safety. Fill missing defaults
      // before zustand merges into state (otherwise EveChatBody crashes on first
      // render with `Cannot read properties of undefined (reading 'speak')`).
      migrate: (persisted, fromVersion) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        if (fromVersion < 2 && p.eve) {
          p.eve = {
            ...DEFAULT_EVE,
            ...p.eve,
            voice: {
              listen: { ...DEFAULT_EVE.voice.listen, ...((p.eve as Partial<EveConfig>).voice?.listen ?? {}) },
              speak: { ...DEFAULT_EVE.voice.speak, ...((p.eve as Partial<EveConfig>).voice?.speak ?? {}) },
            },
            safety: { ...DEFAULT_EVE.safety, ...((p.eve as Partial<EveConfig>).safety ?? {}) },
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
