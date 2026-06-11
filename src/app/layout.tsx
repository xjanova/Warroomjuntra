import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai, JetBrains_Mono, Cinzel } from 'next/font/google';
import './globals.css';

const thai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-thai',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});

const rune = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-rune',
});

export const metadata: Metadata = {
  title: 'War Room · Juntra · ศูนย์ควบคุมภารกิจดูดวง',
  description: 'Fortune War Room — Mission Control for the Juntra fortune-telling system',
  icons: { icon: '/assets/juntra-logo.png' },
  // Eve's Google-TTS fallback (lib/eve/voice.ts) streams from
  // translate.google.com, which 404s any request carrying a foreign Referer.
  // <audio> has no per-element referrerpolicy, so it must be document-wide.
  // Safe for the admin API: CORS keys off Origin, which this doesn't touch.
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  themeColor: '#0a0e17',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${thai.variable} ${mono.variable} ${rune.variable}`}>
      <body className="font-ui antialiased text-fg bg-base h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
