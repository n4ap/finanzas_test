import type { AIProvider, CalendarProvider, EmailProvider, FinanceProvider, NewsProvider } from './types';

/** Registro de adapters (interfaces en types.ts). El catálogo de abajo refleja honestamente qué está implementado y qué no. */
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

export const integrationCatalog: { group: string; kind: ProviderKind; id: string; name: string; status: 'planned' | 'available'; note?: string }[] = [
  { group: 'Calendario', kind: 'calendar', id: 'ics', name: 'Suscripción iCal (.ics / webcal)', status: 'available', note: 'Solo lectura; URL cifrada; sincroniza a mano o por planificador' },
  { group: 'Noticias', kind: 'news', id: 'rss', name: 'Feeds RSS / Atom', status: 'available' },
  { group: 'Finanzas', kind: 'finance', id: 'csv', name: 'Importación CSV', status: 'available' },
  { group: 'IA', kind: 'ai', id: 'local', name: 'Asistente local (reglas + herramientas)', status: 'available' },
  { group: 'IA', kind: 'ai', id: 'anthropic', name: 'Claude (Anthropic) con clave propia', status: 'available', note: 'Sin credenciales de OAuth; la clave se guarda cifrada' },
  // Requieren registrar la app en el proveedor (OAuth propio) o acuerdos externos: la interfaz EmailProvider/CalendarProvider ya existe.
  { group: 'Google', kind: 'email', id: 'gmail', name: 'Gmail', status: 'planned', note: 'Requiere credenciales OAuth de Google' },
  { group: 'Google', kind: 'calendar', id: 'google-calendar', name: 'Google Calendar (lectura y escritura)', status: 'planned', note: 'Requiere credenciales OAuth de Google' },
  { group: 'Microsoft', kind: 'email', id: 'outlook', name: 'Outlook', status: 'planned', note: 'Requiere registro de la app en Microsoft Entra' },
  { group: 'Microsoft', kind: 'calendar', id: 'outlook-calendar', name: 'Calendario de Outlook (lectura y escritura)', status: 'planned', note: 'Requiere registro de la app en Microsoft Entra' },
  { group: 'IA', kind: 'ai', id: 'openai', name: 'OpenAI', status: 'planned' },
  { group: 'IA', kind: 'ai', id: 'google', name: 'Google Gemini', status: 'planned' },
  { group: 'IA', kind: 'ai', id: 'ollama', name: 'Modelos locales (Ollama)', status: 'planned', note: 'Solo útil si el servidor puede alcanzar tu Ollama' },
];
