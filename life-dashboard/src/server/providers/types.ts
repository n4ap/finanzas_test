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

export interface AIMessageDTO {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

/** Herramienta interna que el asistente puede invocar (en lugar de inventarse datos). */
export interface AITool {
  name: string;
  description: string;
  run(userId: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface AIProvider {
  readonly id: string;
  /** El proveedor decide qué tools usar y redacta la respuesta a partir de sus resultados. */
  respond(input: { userId: string; history: AIMessageDTO[]; tools: AITool[] }): Promise<{ content: string; toolCalls: { name: string; args: unknown }[] }>;
}
