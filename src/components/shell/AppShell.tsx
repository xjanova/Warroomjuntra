'use client';

import type { ReactNode } from 'react';
import { NavRail } from './NavRail';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { ToastStack } from './ToastStack';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { CommandPalette } from './CommandPalette';
import { Eve } from '@/components/eve/Eve';
import { CaseDetailDrawer } from '@/components/drawers/CaseDetailDrawer';
import { Customer360Drawer } from '@/components/drawers/Customer360Drawer';
import { SettingsDrawer } from '@/components/drawers/SettingsDrawer';
import { SettingsBridge } from './SettingsBridge';
import { EveBridge } from './EveBridge';
import { AlertBridge } from './AlertBridge';
import { useWarroom } from '@/lib/stores/warroom';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { focusMode, criticalFlash } = useWarroom();
  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <NavRail />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
        {criticalFlash && <div className="absolute inset-0 z-40 alert-screen" />}
        <TopBar />
        <main className={cn('flex-1 min-h-0 overflow-hidden', focusMode && 'focus-dim')}>
          {children}
        </main>
        <StatusBar />
      </div>
      <ToastStack />
      <CommandPalette />
      <KeyboardShortcuts />
      <CaseDetailDrawer />
      <Customer360Drawer />
      <SettingsDrawer />
      <Eve />
      <SettingsBridge />
      <EveBridge />
      <AlertBridge />
    </div>
  );
}
