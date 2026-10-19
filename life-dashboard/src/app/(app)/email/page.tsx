import { EmailView } from '@/components/email/email-view';
import { db } from '@/lib/db';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Email' };
export const dynamic = 'force-dynamic';

export default async function EmailPage() {
  const user = await requireUser();
  const emails = await db.email.findMany({ where: { userId: user.id }, orderBy: { receivedAt: 'desc' }, take: 200 });
  return (
    <EmailView
      emails={emails.map((e) => ({
        id: e.id, folder: e.folder, fromName: e.fromName, fromEmail: e.fromEmail, toEmails: e.toEmails, subject: e.subject, body: e.body, snippet: e.snippet,
        receivedAt: e.receivedAt.toISOString(), read: e.read, starred: e.starred, important: e.important, needsReply: e.needsReply, replied: e.replied,
        deadline: e.deadline?.toISOString() ?? null, category: e.category, summary: e.summary,
      }))}
    />
  );
}
