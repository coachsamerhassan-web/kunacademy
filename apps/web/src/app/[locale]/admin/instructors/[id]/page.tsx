import InstructorForm from '../_form';

export default async function EditInstructorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <InstructorForm instructorId={id} />;
}
