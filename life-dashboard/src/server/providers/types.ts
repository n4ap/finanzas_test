/**
 * Contratos de integración. La app depende SOLO de estas interfaces; cada proveedor
 * (Gmail, Outlook, Google Calendar, Ollama, OpenAI...) es un adapter que las implementa.
 */
export interface ProviderContext {
  userId: string;
}

export interface EmailMessage {
  externalId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: Date;
  read: boolean;
}

export interface EmailProvider {
  readonly id: string;
  listInbox(ctx: ProviderContext, opts?: { since?: Date; limit?: number }): Promise<EmailMessage[]>;
  /** Nunca envía: solo guarda el borrador. El envío exige confirmación explícita del usuario. */
  createDraft(ctx: ProviderContext, input: { to: string; subject: string; body: string }): Promise<{ draftId: string }>;
}

export interface CalendarEventDTO {
  externalId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string;
  attendees?: string[];
  description?: string;
}

export interface CalendarProvider {
  readonly id: string;
  listCalendars(ctx: ProviderContext): Promise<{ externalId: string; name: string }[]>;
  listEvents(ctx: ProviderContext, calendarExternalId: string, range: { from: Date; to: Date }): Promise<CalendarEventDTO[]>;
  upsertEvent(ctx: ProviderContext, calendarExternalId: string, event: CalendarEventDTO): Promise<CalendarEventDTO>;
  deleteEvent(ctx: ProviderContext, calendarExternalId: string, externalId: string): Promise<void>;
}

export interface NewsItemDTO {
  externalId: string;
  title: string;
  source: string;
  url: string;
  imageUrl?: string;
  summary: string;
  category: string;
  publishedAt: Date;
}

export interface NewsProvider {
  readonly id: string;
  fetchTopHeadlines(categories: string[]): Promise<NewsItemDTO[]>;
}

export interface TransactionDTO {
  date: Date;
  amount: number;
  description: string;
  category?: string;
}

export interface FinanceProvider {
  readonly id: string;
  /** Importa movimientos (CSV, API bancaria). No se conectan bancos reales hasta tener arquitectura segura. */
  importTransactions(ctx: ProviderContext, input: unknown): Promise<TransactionDTO[]>;
}

/** Contexto de una petición al asistente: siempre un usuario autenticado y su zona horaria. */
export interface AIContext {
  userId: string;
  now: Date;
  /** `Date.getTimezoneOffset()` del navegador (minutos, UTC − local). */
  tzOffset: number;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface AIMessageDTO {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant: llamadas solicitadas. */
  toolCalls?: AIToolCall[];
  /** tool: a qué llamada responde. */
  toolCallId?: string;
  toolName?: string;
  /** assistant: carga opaca del proveedor (p. ej. bloques de Claude con su razonamiento) que debe devolverse tal cual dentro del mismo turno. No se persiste. */
  raw?: unknown;
}

/** Descripción de una herramienta para el proveedor (un LLM real la recibiría como JSON Schema). */
export interface AIToolInfo {
  name: string;
  description: string;
  kind: 'read' | 'write';
  /** JSON Schema de los argumentos. */
  inputSchema?: Record<string, unknown>;
}

/**
 * Un proveedor decide qué herramientas llamar y redacta la respuesta a partir de sus resultados.
 * NUNCA accede a la base de datos: solo ve lo que devuelven las herramientas (que el orquestador acota al usuario)
 * y las herramientas de escritura solo crean propuestas que el usuario debe confirmar.
 */
export interface AIProvider {
  readonly id: string;
  respond(input: { ctx: AIContext; history: AIMessageDTO[]; tools: AIToolInfo[] }): Promise<{ content: string; toolCalls: AIToolCall[]; raw?: unknown }>;
}
