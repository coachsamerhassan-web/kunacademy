/** Generate .ics calendar invite content for booking sessions */
export function generateICS(details: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  organizerEmail?: string;
  attendeeEmail?: string;
}): string {
  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@kunacademy.com`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kun Academy//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatDate(details.startTime)}`,
    `DTEND:${formatDate(details.endTime)}`,
    `SUMMARY:${escapeICS(details.title)}`,
    `DESCRIPTION:${escapeICS(details.description)}`,
  ];

  if (details.location) {
    lines.push(`LOCATION:${escapeICS(details.location)}`);
  }
  if (details.organizerEmail) {
    lines.push(`ORGANIZER;CN=Kun Academy:mailto:${details.organizerEmail}`);
  }
  if (details.attendeeEmail) {
    lines.push(`ATTENDEE;RSVP=TRUE:mailto:${details.attendeeEmail}`);
  }

  lines.push(
    `DTSTAMP:${formatDate(new Date())}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n');
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => {
    if (c === '\n') return '\\n';
    return `\\${c}`;
  });
}
