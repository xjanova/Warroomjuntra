import { AppShell } from '@/components/shell/AppShell';
import { AuthGate } from '@/components/auth/AuthGate';

export default function WarroomLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
