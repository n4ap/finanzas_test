import { Bot, Briefcase, CalendarRange, ChartColumn, Compass, Music2, Play, Rss, Telescope, CalendarDays, CheckSquare, Heart, Home, LineChart, Mail, Newspaper, Plane, Settings, Target, Users, Wallet, Zap, type LucideIcon } from 'lucide-react';

export interface NavItem { href: string; label: string; icon: LucideIcon; mobile?: boolean }

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Principal', items: [
    { href: '/dashboard', label: 'Inicio', icon: Home, mobile: true },
    { href: '/coach', label: 'Coach', icon: Compass },
    { href: '/focus', label: 'Focus', icon: Target },
    { href: '/assistant', label: 'Asistente IA', icon: Bot, mobile: true },
  ] },
  { group: 'Organización', items: [
    { href: '/tasks', label: 'Tareas', icon: CheckSquare, mobile: true },
    { href: '/calendar', label: 'Calendario', icon: CalendarDays, mobile: true },
    { href: '/email', label: 'Email', icon: Mail },
    { href: '/projects', label: 'Proyectos', icon: Briefcase },
    { href: '/news', label: 'Noticias', icon: Newspaper },
  ] },
  { group: 'Contenido', items: [
    { href: '/content/youtube', label: 'YouTube', icon: Play },
    { href: '/content/tiktok', label: 'TikTok', icon: Music2 },
    { href: '/content/calendar', label: 'Calendario editorial', icon: CalendarRange },
    { href: '/content/analytics', label: 'Análisis', icon: ChartColumn },
    { href: '/content/competitors', label: 'Competencia', icon: Telescope },
    { href: '/content/news', label: 'Noticias del sector', icon: Rss },
  ] },
  { group: 'Dinero', items: [
    { href: '/finance', label: 'Finanzas', icon: Wallet, mobile: true },
    { href: '/investments', label: 'Inversiones', icon: LineChart },
  ] },
  { group: 'Vida', items: [
    { href: '/health', label: 'Salud', icon: Heart },
    { href: '/travel', label: 'Viajes', icon: Plane },
    { href: '/family', label: 'Familia', icon: Users },
  ] },
  { group: 'Sistema', items: [
    { href: '/automations', label: 'Automatizaciones', icon: Zap },
    { href: '/settings', label: 'Ajustes', icon: Settings },
  ] },
];

/** Orden de la barra inferior móvil: Inicio, Tareas, Calendario, Finanzas, IA. */
export const MOBILE_NAV: NavItem[] = ['/dashboard', '/tasks', '/calendar', '/finance', '/assistant']
  .map((h) => NAV.flatMap((g) => g.items).find((i) => i.href === h)!);

/** Secciones del estudio de contenido (también su barra de pestañas propia, útil en el móvil). */
export const CONTENT_NAV: NavItem[] = NAV.find((g) => g.group === 'Contenido')!.items;
