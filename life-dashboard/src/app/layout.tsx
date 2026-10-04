import type { Metadata, Viewport } from 'next';
import './globals.css';
import { themeInitScript } from '@/components/ui/theme';

export const metadata: Metadata = { title: { default: 'Life Dashboard', template: '%s · Life Dashboard' }, description: 'Tu centro de control personal' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0e1117' }, { color: '#f6f7fb' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
