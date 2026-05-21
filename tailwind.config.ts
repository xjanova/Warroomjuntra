import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // surfaces
        void: '#06090f',
        base: '#0a0e17',
        panel: '#111827',
        panel2: '#0d1320',
        rowhi: '#1a2335',
        line: '#1f2937',
        lined: '#172033',
        // text
        fg: '#e5e7eb',
        dim: '#9ca3af',
        mute: '#6b7280',
        ghost: '#4b5563',
        // status
        ok: '#10b981',
        warn: '#f59e0b',
        crit: '#ef4444',
        info: '#22d3ee',
        mystic: '#8b5cf6',
        rose: '#f43f5e',
        // brand accent
        gold: '#d4a747',
        'gold-light': '#f5d480',
        'gold-dark': '#8b6a1f',
        // channels
        fb: '#1877f2',
        line2: '#06c755',
      },
      fontFamily: {
        ui: ['var(--font-thai)', 'Sarabun', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
        rune: ['var(--font-rune)', 'serif'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      boxShadow: {
        'glow-crit': '0 0 0 1px rgba(239,68,68,.45), 0 0 28px rgba(239,68,68,.18), inset 0 0 0 1px rgba(239,68,68,.15)',
        'glow-info': '0 0 0 1px rgba(34,211,238,.4), 0 0 16px rgba(34,211,238,.18)',
        'glow-ok': '0 0 0 1px rgba(16,185,129,.4), 0 0 12px rgba(16,185,129,.15)',
        'glow-mystic': '0 0 0 1px rgba(139,92,246,.15), 0 0 60px rgba(139,92,246,.22)',
      },
      keyframes: {
        blink: { '50%': { opacity: '.35' } },
        alertborder: {
          '0%,100%': {
            boxShadow: 'inset 0 0 0 2px rgba(239,68,68,.55), inset 0 0 80px rgba(239,68,68,.12)',
          },
          '50%': {
            boxShadow: 'inset 0 0 0 2px rgba(239,68,68,.9), inset 0 0 120px rgba(239,68,68,.22)',
          },
        },
        ticker: { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '32px 0' } },
        navPulse: {
          '0%,100%': { boxShadow: '0 0 6px rgba(239,68,68,.4)' },
          '50%': { boxShadow: '0 0 12px rgba(239,68,68,.7)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(1.012) translateY(-2px)' },
        },
        ringSpin: { to: { transform: 'rotate(360deg)' } },
        ringSpinR: { to: { transform: 'rotate(-360deg)' } },
        eveBlink: {
          '0%,90%,100%': { transform: 'scaleY(1)' },
          '95%': { transform: 'scaleY(0.08)' },
        },
        eveSparkle: {
          '0%,100%': { opacity: '0', transform: 'translateY(0) scale(.4)' },
          '50%': { opacity: '1', transform: 'translateY(-12px) scale(1)' },
        },
      },
      animation: {
        blink: 'blink 1s steps(2) infinite',
        alert: 'alertborder 1.4s ease-in-out infinite',
        ticker: 'ticker 1.2s linear infinite',
        navPulse: 'navPulse 1.6s ease-in-out infinite',
        breathe: 'breathe 3.6s ease-in-out infinite',
        ringSpin: 'ringSpin 60s linear infinite',
        ringSpinR: 'ringSpinR 90s linear infinite',
        eveBlink: 'eveBlink 5.2s ease-in-out infinite',
        eveSparkle: 'eveSparkle 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
