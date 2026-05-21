import { AppShell } from '@/components/shell/AppShell';

export default function WarroomLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
