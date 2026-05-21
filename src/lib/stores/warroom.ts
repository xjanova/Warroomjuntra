'use client';

import { create } from 'zustand';

export type PresenceUser = {
  id: string;
  initial: string;
  name: string;
  role: 'lead' | 'senior' | 'junior' | 'mommor' | 'idle';
  online: boolean;
};

export type ToastKind = 'ok' | 'warn' | 'crit' | 'info' | 'mystic';

export type ToastMsg = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  createdAt: number;
};

type WarroomState = {
  clock: string;
  dateStr: string;
  frozen: boolean;
  muted: boolean;
  focusMode: boolean;
  refreshInterval: 2 | 5 | 10 | 30;
  criticalFlash: boolean;
  presence: PresenceUser[];
  toasts: ToastMsg[];

  cmdkOpen: boolean;
  caseDrawerId: string | null;
  customerDrawerId: string | null;
  settingsOpen: boolean;

  // setters
  setClock: (clock: string, dateStr: string) => void;
  setFrozen: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setFocusMode: (v: boolean) => void;
  setRefreshInterval: (v: 2 | 5 | 10 | 30) => void;
  setCriticalFlash: (v: boolean) => void;
  setCmdkOpen: (v: boolean) => void;
  openCaseDrawer: (id: string) => void;
  closeCaseDrawer: () => void;
  openCustomerDrawer: (id: string) => void;
  closeCustomerDrawer: () => void;
  setSettingsOpen: (v: boolean) => void;

  pushToast: (t: Omit<ToastMsg, 'id' | 'createdAt'>) => void;
  dismissToast: (id: string) => void;
};

export const useWarroom = create<WarroomState>((set) => ({
  clock: '--:--:--',
  dateStr: '',
  frozen: false,
  muted: false,
  focusMode: false,
  refreshInterval: 5,
  criticalFlash: false,
  presence: [
    { id: 'u1', initial: 'A', name: 'อภิชาต', role: 'lead', online: true },
    { id: 'u2', initial: 'B', name: 'เบลล์', role: 'senior', online: true },
    { id: 'u3', initial: 'C', name: 'ชนิดา', role: 'junior', online: true },
    { id: 'u4', initial: 'J', name: 'แม่หมอจันทรา', role: 'mommor', online: true },
    { id: 'u5', initial: 'P', name: 'พลอย', role: 'idle', online: false },
  ],
  toasts: [],

  cmdkOpen: false,
  caseDrawerId: null,
  customerDrawerId: null,
  settingsOpen: false,

  setClock: (clock, dateStr) => set({ clock, dateStr }),
  setFrozen: (v) => set({ frozen: v }),
  setMuted: (v) => set({ muted: v }),
  setFocusMode: (v) => set({ focusMode: v }),
  setRefreshInterval: (v) => set({ refreshInterval: v }),
  setCriticalFlash: (v) => set({ criticalFlash: v }),
  setCmdkOpen: (v) => set({ cmdkOpen: v }),
  openCaseDrawer: (id) => set({ caseDrawerId: id }),
  closeCaseDrawer: () => set({ caseDrawerId: null }),
  openCustomerDrawer: (id) => set({ customerDrawerId: id }),
  closeCustomerDrawer: () => set({ customerDrawerId: null }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  pushToast: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          ...t,
          id: Math.random().toString(36).slice(2, 10),
          createdAt: Date.now(),
        },
      ].slice(-6),
    })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
