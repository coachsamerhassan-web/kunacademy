'use client';

import { use } from 'react';
import TestimonialForm from '../_form';

export default function EditTestimonialPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = use(params);
  return <TestimonialForm testimonialId={id} />;
}
