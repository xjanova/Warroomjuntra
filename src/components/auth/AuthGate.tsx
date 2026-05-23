'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { verifyConnection } from '@/lib/api';
import Image from 'next/image';

/**
 * AuthGate — sits inside (warroom) layout. If the operator isn't paired,
 * redirects to /login. To avoid a flash of warroom content while we wait for
 * the SettingsBridge's verifyConnection() to settle, we hold a brief splash:
 *
 *   • on first paint: if status === 'testing' or (token && status === 'idle'),
 *     show splash
 *   • once status resolves to 'paired' → render children
 *   • once status resolves to anything else → redirect to /login
 *
 * Static export-friendly: redirect happens client-side via router.replace().
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const conn = useSettings((s) => s.connection);
  const paired = useSettings((s) => isPairedFn(s));
  // Track whether we've waited at least one tick after mount — prevents
  // flashing the warroom-shell skeleton while persist+verify hydrate.
  const [mounted, setMounted] = useState(false);
  // Track whether we've already kicked off a verify so we don't spam it
  const verifyKicked = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If we have saved creds but haven't verified yet, kick off verifyConnection
  // ourselves — don't rely on SettingsBridge (which only mounts inside AppShell,
  // which is what we're gating). Without this, the splash hangs forever.
  useEffect(() => {
    if (!mounted) return;
    if (verifyKicked.current) return;
    if (paired) return;
    if (conn.token && conn.baseUrl && conn.status === 'idle') {
      verifyKicked.current = true;
      void verifyConnection();
    }
  }, [mounted, paired, conn.status, conn.token, conn.baseUrl]);

  useEffect(() => {
    if (!mounted) return;
    if (paired) return;
    // Don't redirect mid-verification — let it finish.
    if (conn.status === 'testing') return;
    // If we have credentials but verify hasn't fired yet, give it one tick.
    if (conn.token && conn.baseUrl && conn.status === 'idle' && !verifyKicked.current) return;
    // Otherwise: no creds, or error state, or verify-failed — redirect to login.
    if (pathname !== '/login') router.replace('/login');
  }, [mounted, paired, conn.status, conn.token, conn.baseUrl, pathname, router]);

  // Splash while we're hydrating + verifying (or before mount)
  const showSplash = !mounted ||
    (!paired && conn.status === 'testing') ||
    (!paired && conn.token && conn.baseUrl && conn.status === 'idle');

  if (showSplash) {
    return <AuthSplash />;
  }

  // Not paired AND not on login → redirect already fired; render nothing
  if (!paired) {
    return <AuthSplash hint="กำลังเปลี่ยนเส้นทางไปหน้าเข้าสู่ระบบ..." />;
  }

  return <>{children}</>;
}

function AuthSplash({ hint }: { hint?: string }) {
  return (
    <div
      className="h-screen w-screen grid place-items-center"
      style={{
        background:
          'radial-gradient(circle at 30% 20%, rgba(139, 92, 246, .15), transparent 55%),' +
          'linear-gradient(135deg, #1a1330, #0a0e17 60%)',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14 rounded-md overflow-hidden border border-mystic/40 shadow-[0_0_24px_rgba(139,92,246,.45)] animate-pulse">
          <Image
            src="/assets/juntra-logo.png"
            alt="Juntra"
            fill
            sizes="56px"
            priority
            className="object-cover"
          />
        </div>
        <div className="font-rune text-lg tracking-[.3em] text-mystic">JUNTRA</div>
        <div className="text-2xs text-mute mono tracking-widest">
          {hint ?? 'กำลังตรวจสอบสถานะ...'}
        </div>
        <div className="auth-splash-dots flex gap-1 mt-1">
          <span /><span /><span />
        </div>
      </div>
      <style jsx>{`
        .auth-splash-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(139, 92, 246, .6);
          animation: dot-bounce 1.2s ease-in-out infinite;
        }
        .auth-splash-dots span:nth-child(2) { animation-delay: 0.15s; }
        .auth-splash-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dot-bounce {
          0%, 80%, 100% { opacity: .3; transform: translateY(0); }
          40%           { opacity: 1;  transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
