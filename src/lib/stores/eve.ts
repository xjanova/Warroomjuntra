'use client';

import { create } from 'zustand';

export type EveMode = 'open' | 'min' | 'hidden';
export type EveMood = 'idle' | 'happy' | 'talking' | 'thinking' | 'concerned' | 'surprise';
// Real AI-chat reachability, set from the actual /eve/chat outcome (NOT pairing).
// 'unknown' = not tried yet · 'online' = last chat succeeded · 'offline' = last chat failed.
// Drives an HONEST status badge so Eve never claims "online" while the AI is unreachable.
export type EveAiStatus = 'unknown' | 'online' | 'offline';

export type EveMessage = {
  id: string;
  role: 'eve' | 'user';
  text: string;
  ts: number;
};

// 🤖 (2026-06-04) A management action Eve wants to run but is waiting on the
//   operator to confirm (ask-permission mode). Rendered as a card in the chat
//   with ยืนยัน / ยกเลิก buttons. `tag`/`args` mirror a ParsedAction so the same
//   executor runs it once approved.
export type PendingAction = {
  id: string;
  tag: string;
  args: string[];
  label: string;             // human-readable Thai summary of what will happen
  kind: 'ok' | 'warn' | 'crit';
  status: 'pending' | 'running' | 'done' | 'error';
  result?: string;           // outcome message after it runs
  ts: number;
};

type EveState = {
  mode: EveMode;
  mood: EveMood;
  typing: boolean;
  aiStatus: EveAiStatus;
  messages: EveMessage[];
  pending: PendingAction[];
  // tunable face geometry (CSS vars)
  eyeY: number;
  eyeLX: number;
  eyeRX: number;
  mouthX: number;
  mouthY: number;

  setMode: (m: EveMode) => void;
  setMood: (m: EveMood) => void;
  setTyping: (v: boolean) => void;
  setAiStatus: (s: EveAiStatus) => void;
  addMessage: (msg: Omit<EveMessage, 'id' | 'ts'>) => void;
  clearMessages: () => void;
  setFace: (face: Partial<Pick<EveState, 'eyeY' | 'eyeLX' | 'eyeRX' | 'mouthX' | 'mouthY'>>) => void;

  // Pending-confirmation queue (ask-permission mode)
  addPending: (p: Omit<PendingAction, 'id' | 'ts' | 'status'>) => string;
  setPendingStatus: (id: string, status: PendingAction['status'], result?: string) => void;
  removePending: (id: string) => void;
};

export const useEve = create<EveState>((set) => ({
  mode: 'open',
  mood: 'idle',
  typing: false,
  aiStatus: 'unknown',
  messages: [],
  pending: [],
  // Calibrated against eve.svg artwork — full-body figure, face in top quarter.
  // User can fine-tune via the ⚙ button on Eve's header.
  eyeY: 26,
  eyeLX: 45,
  eyeRX: 55,
  mouthX: 50,
  mouthY: 31,
  setMode: (mode) => set({ mode }),
  setMood: (mood) => set({ mood }),
  setTyping: (typing) => set({ typing }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: Math.random().toString(36).slice(2, 10), ts: Date.now() },
      ],
    })),
  clearMessages: () => set({ messages: [] }),
  setFace: (face) => set(face as Partial<EveState>),

  addPending: (p) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((s) => ({
      pending: [...s.pending, { ...p, id, status: 'pending', ts: Date.now() }],
    }));
    return id;
  },
  setPendingStatus: (id, status, result) =>
    set((s) => ({
      pending: s.pending.map((p) => (p.id === id ? { ...p, status, result: result ?? p.result } : p)),
    })),
  removePending: (id) => set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
}));
