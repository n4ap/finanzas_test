import type { AIProvider, CalendarProvider, EmailProvider, FinanceProvider, NewsProvider } from './types';

/** Registro de adapters. Fase 6 registrará aquí Gmail, Outlook, Google Calendar, Ollama, OpenAI, etc. */
interface Registry {
  email: Map<string, EmailProvider>;
  calendar: Map<string, CalendarProvider>;
  news: Map<string, NewsProvider>;
  finance: Map<string, FinanceProvider>;
  ai: Map<string, AIProvider>;
}

export const registry: Registry = {
  email: new Map(),
  calendar: new Map(),
  news: new Map(),
  finance: new Map(),
  ai: new Map(),
};

export type ProviderKind = keyof Registry;

export const integrationCatalog: { group: string; kind: ProviderKind; id: string; name: string; status: 'planned' | 'available' }[] = [
  { group: 'Google', kind: 'email', id: 'gmail', name: 'Gmail', status: 'planned' },
  { group: 'Google', kind: 'calendar', id: 'google-calendar', name: 'Google Calendar', status: 'planned' },
  { group: 'Microsoft', kind: 'email', id: 'outlook', name: 'Outlook', status: 'planned' },
  { group: 'Microsoft', kind: 'calendar', id: 'outlook-calendar', name: 'Calendario de Outlook', status: 'planned' },
  { group: 'Noticias', kind: 'news', id: 'news-api', name: 'APIs de noticias', status: 'planned' },
  { group: 'Finanzas', kind: 'finance', id: 'csv', name: 'Importación CSV', status: 'available' },
  { group: 'IA', kind: 'ai', id: 'local', name: 'Asistente local (reglas + tools)', status: 'available' },
  { group: 'IA', kind: 'ai', id: 'openai', name: 'OpenAI', status: 'planned' },
  { group: 'IA', kind: 'ai', id: 'anthropic', name: 'Anthropic', status: 'planned' },
  { group: 'IA', kind: 'ai', id: 'google', name: 'Google Gemini', status: 'planned' },
  { group: 'IA', kind: 'ai', id: 'ollama', name: 'Modelos locales (Ollama)', status: 'planned' },
];
