export interface EmailDTO {
  id: string; folder: string; fromName: string; fromEmail: string; toEmails: string[]; subject: string; body: string; snippet: string;
  receivedAt: string; read: boolean; starred: boolean; important: boolean; needsReply: boolean; replied: boolean;
  deadline: string | null; category: string | null; summary: string | null;
}
export type EmailFolder = 'inbox' | 'unread' | 'important' | 'sent' | 'starred';
export const FOLDER_LABEL: Record<EmailFolder, string> = { inbox: 'Bandeja de entrada', unread: 'No leídos', important: 'Importantes', sent: 'Enviados', starred: 'Destacados' };
