'use client';

import { use } from 'react';
import ProgramForm from '../_form';

export default function EditProgram({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  return <ProgramForm programId={id} />;
}
