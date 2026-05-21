'use client';

import { create } from 'zustand';

export type EveMode = 'open' | 'min' | 'hidden';
export type EveMood = 'idle' | 'happy' | 'talking' | 'thinking' | 'concerned' | 'surprise';

export type EveMessage = {
  id: string;
  role: 'eve' | 'user';
  text: string;
  ts: number;
};

type EveState = {
  mode: EveMode;
  mood: EveMood;
  typing: boolean;
  messages: EveMessage[];
  // tunable face geometry (CSS vars)
  eyeY: number;
  eyeLX: number;
  eyeRX: number;
  mouthX: number;
  mouthY: number;

  setMode: (m: EveMode) => void;
  setMood: (m: EveMood) => void;
  setTyping: (v: boolean) => void;
  addMessage: (msg: Omit<EveMessage, 'id' | 'ts'>) => void;
  clearMessages: () => void;
  setFace: (face: Partial<Pick<EveState, 'eyeY' | 'eyeLX' | 'eyeRX' | 'mouthX' | 'mouthY'>>) => void;
};

export const useEve = create<EveState>((set) => ({
  mode: 'open',
  mood: 'idle',
  typing: false,
  messages: [],
  // Calibrated against eve.svg artwork — full-body figure, face in top quarter.
  // User can fine-tune via the ⚙ button on Eve's header.
  eyeY: 26,
  eyeLX: 43,
  eyeRX: 57,
  mouthX: 50,
  mouthY: 31,
  setMode: (mode) => set({ mode }),
  setMood: (mood) => set({ mood }),
  setTyping: (typing) => set({ typing }),
  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: Math.random().toString(36).slice(2, 10), ts: Date.now() },
      ],
    })),
  clearMessages: () => set({ messages: [] }),
  setFace: (face) => set(face as Partial<EveState>),
}));
