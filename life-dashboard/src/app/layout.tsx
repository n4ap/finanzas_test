import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { themeInitScript } from '@/components/ui/theme';

export const metadata: Metadata = { title: { default: 'Life Dashboard', template: '%s · Life Dashboard' }, description: 'Tu centro de control personal', icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' }, appleWebApp: { capable: true, title: 'Life', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0e1117' }, { color: '#f6f7fb' }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined; // el CSP solo permite scripts con este nonce
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
