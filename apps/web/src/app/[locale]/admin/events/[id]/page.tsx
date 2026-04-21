'use client';

import { use } from 'react';
import EventForm from '../_form';

export default function EditEvent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  return <EventForm eventId={id} />;
}
