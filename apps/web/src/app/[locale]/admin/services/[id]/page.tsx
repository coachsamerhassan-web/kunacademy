'use client';

import { use } from 'react';
import ServiceForm from '../_form';

export default function EditServicePage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = use(params);
  return <ServiceForm serviceId={id} />;
}
