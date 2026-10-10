export interface CalendarDTO { id: string; name: string; color: string; isDefault: boolean }
export interface EventDTO {
  id: string; calendarId: string; title: string; description: string | null; location: string | null;
  startsAt: string; endsAt: string; allDay: boolean; attendees: string[]; important: boolean;
}
