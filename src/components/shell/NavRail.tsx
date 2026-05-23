'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed, useAdminData, fetchPendingWithdrawals } from '@/lib/api';
import { useMemo } from 'react';

type NavItem = {
  key: string;
  href: string;
  label: string;
  badge?: string;
  icon: React.ReactNode;
};

const STATIC_ITEMS: NavItem[] = [
  {
    key: 'warroom',
    href: '/',
    label: 'War',
    icon: (
      <path d="M12 2L4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-5z" />
    ),
  },
  {
    key: 'chat',
    href: '/chat',
    label: 'แชต',
    icon: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.38 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 21 11.5z" />,
  },
  {
    key: 'eve',
    href: '/eve',
    label: 'Eve',
    icon: (
      <>
        <path d="M12 2l1.5 4 4 1.5-4 1.5L12 13l-1.5-4-4-1.5 4-1.5z" />
        <circle cx="12" cy="18" r="2" />
      </>
    ),
  },
  {
    key: 'predict',
    href: '/predict',
    label: 'ทำนาย',
    icon: <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.4L12 14.5 7.1 17.1 8 11.7 4 7.8 9.5 7z" />,
  },
  {
    key: 'bills',
    href: '/bills',
    label: 'บิล',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </>
    ),
  },
  {
    key: 'payment',
    href: '/payment',
    label: 'การเงิน',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8M12 8v8" />
      </>
    ),
  },
  {
    key: 'approvals',
    href: '/approvals',
    label: 'อนุมัติ',
    icon: <polyline points="20 6 9 17 4 12" />,
  },
  {
    key: 'moderation',
    href: '/moderation',
    label: 'เฝ้าระวัง',
    icon: (
      <>
        <path d="M12 2L4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-5z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    key: 'bots',
    href: '/bots',
    label: 'บอท',
    icon: (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </>
    ),
  },
  {
    key: 'workers',
    href: '/workers',
    label: 'DM-W',
    icon: (
      <>
        <path d="M21 11.5a8.38 8.38 0 0 1-9 8.38 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 21 11.5z" />
        <circle cx="8.5" cy="11.5" r="1" />
        <circle cx="12" cy="11.5" r="1" />
        <circle cx="15.5" cy="11.5" r="1" />
      </>
    ),
  },
  {
    key: 'usage',
    href: '/usage',
    label: 'API',
    icon: (
      <>
        <polyline points="3 17 9 11 13 15 21 6" />
        <polyline points="14 6 21 6 21 13" />
      </>
    ),
  },
  {
    key: 'customers',
    href: '/customers',
    label: 'ลูกค้า',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    key: 'events',
    href: '/events',
    label: 'อีเวนต์',
    icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  },
];

export function NavRail() {
  const pathname = usePathname();
  const setSettingsOpen = useWarroom((s) => s.setSettingsOpen);

  // Live badge counts. Falls back to undefined when not paired — keeps the rail
  // honest rather than displaying frozen mock numbers like "12 chat / 5 approvals".
  const feed = useFortuneFeed();
  const withdrawals = useAdminData<number | null>({
    key: 'navrail-withdrawals',
    fetcher: async () => {
      const res = await fetchPendingWithdrawals();
      const arr = Array.isArray(res) ? res : res.data;
      return arr.length;
    },
    mock: null,
    intervalOverride: 30, // refresh slower than the home page
  });

  const badges = useMemo<Record<string, string | undefined>>(() => {
    if (feed.source !== 'live') return {};
    const pending = feed.data.filter((r) => !r.responded_at || r.response_type === 'pending').length;
    const admin = feed.data.filter((r) => r.response_type === 'admin').length;
    return {
      chat: pending > 0 ? String(pending) : undefined,
      approvals: withdrawals.data && withdrawals.data > 0 ? String(withdrawals.data) : undefined,
      moderation: admin > 0 ? String(admin) : undefined,
    };
  }, [feed.data, feed.source, withdrawals.data]);

  const ITEMS = useMemo(
    () => STATIC_ITEMS.map((it) => ({ ...it, badge: badges[it.key] ?? it.badge })),
    [badges],
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <aside className="w-14 bg-void border-r border-line flex flex-col py-2 gap-0.5 shrink-0 overflow-y-auto">
      <Link href="/" className="w-14 h-12 grid place-items-center mb-2" title="Warroom Juntra">
        <span className="brand-orb" aria-hidden />
      </Link>

      {ITEMS.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          title={it.label}
          className={cn(
            'nav-item relative flex flex-col items-center gap-0.5 px-1 py-2',
            'text-mute hover:text-fg hover:bg-info/5',
            'border-l-2 border-transparent transition-colors',
            isActive(it.href) && 'text-info border-info bg-info/8',
          )}
          style={isActive(it.href) ? { borderLeftColor: '#22d3ee', background: 'rgba(34,211,238,.08)' } : undefined}
        >
          {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
          <span className="w-6 h-6 grid place-items-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {it.icon}
            </svg>
          </span>
          <span className="text-[9px] tracking-[.04em]">{it.label}</span>
        </Link>
      ))}

      <div className="h-px bg-line mx-3 my-2" />

      <button
        type="button"
        title="ตั้งค่า"
        onClick={() => setSettingsOpen(true)}
        className="nav-item flex flex-col items-center gap-0.5 px-1 py-2 text-mute hover:text-fg hover:bg-info/5 border-l-2 border-transparent transition-colors"
      >
        <span className="w-6 h-6 grid place-items-center">
          <SettingsIcon size={18} strokeWidth={2} />
        </span>
        <span className="text-[9px] tracking-[.04em]">ตั้งค่า</span>
      </button>

      <style jsx>{`
        .brand-orb {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          position: relative;
          background:
            radial-gradient(circle at 60% 40%, rgba(212, 167, 71, 0.18), transparent 60%),
            radial-gradient(circle at 30% 80%, rgba(139, 92, 246, 0.15), transparent 50%),
            #0a0e17;
          border: 1px solid rgba(212, 167, 71, 0.35);
          box-shadow:
            0 0 12px rgba(212, 167, 71, 0.22),
            inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .brand-orb::before {
          content: '';
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 65% 35%, #f5d480 0%, #d4a747 55%, #8b6a1f 100%);
          box-shadow: 0 0 10px rgba(212, 167, 71, 0.5);
        }
        .brand-orb::after {
          content: '';
          position: absolute;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #0a0e17;
          transform: translate(5px, -2px);
        }
        .nav-badge {
          position: absolute;
          top: 4px;
          right: 8px;
          font-size: 8px;
          background: #ef4444;
          color: #fff;
          padding: 0 4px;
          border-radius: 6px;
          font-weight: 700;
          line-height: 12px;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
          animation: navPulse 1.6s ease-in-out infinite;
        }
        @keyframes navPulse {
          0%,
          100% {
            box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.7);
          }
        }
      `}</style>
    </aside>
  );
}
