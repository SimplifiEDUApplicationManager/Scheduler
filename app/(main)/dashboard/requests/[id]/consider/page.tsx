import { notFound } from 'next/navigation';
import { REQUESTS, TUTORS } from '@/lib/data/mock';
import { ConsiderRequestClient } from '@/components/features/requests/ConsiderRequestClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConsiderRequestPage({ params }: Props) {
  const { id } = await params;
  const request = REQUESTS.find(r => r.id === id);

  if (!request) notFound();

  return (
    <ConsiderRequestClient
      request={request}
      tutors={TUTORS}
    />
  );
}
