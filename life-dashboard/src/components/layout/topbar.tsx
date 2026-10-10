import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme';
import type { CurrentUser } from '@/server/auth';
import type { Weather } from '@/server/weather';
import { GreetingClock } from './clock';
import { CommandPalette } from './command-palette';
import { NotificationCenter, type NotificationDTO } from './notification-center';
import { UserMenu } from './user-menu';

export function Topbar({ user, weather, notifications }: { user: CurrentUser; weather: Weather | null; notifications: NotificationDTO[] }) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
      <GreetingClock name={user.name} />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {weather && (
          <span className="hidden items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm sm:flex" title={`${weather.label} en ${user.city}`}>
            <span aria-hidden>{weather.emoji}</span> {weather.tempC}°C <span className="text-muted-foreground">{user.city}</span>
          </span>
        )}
        <CommandPalette />
        <Link href="/assistant" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90" aria-label="Abrir asistente IA">
          <Sparkles size={15} /> <span className="hidden sm:inline">Asistente</span>
        </Link>
        <NotificationCenter items={notifications} />
        <ThemeToggle />
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
