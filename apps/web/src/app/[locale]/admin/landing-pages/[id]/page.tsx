'use client';

import { use } from 'react';
import LandingPageForm from '../_form';

export default function EditLandingPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  return <LandingPageForm pageId={id} />;
}
