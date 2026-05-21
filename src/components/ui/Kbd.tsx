import { cn } from '@/lib/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('kbd', className)}>{children}</span>;
}
