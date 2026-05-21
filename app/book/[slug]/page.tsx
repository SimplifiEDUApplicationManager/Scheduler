import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { BookingPage } from '@/components/features/booking/BookingPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Look up the tutor whose booking URL ends with this slug.
  const { data: tutor } = await supabase
    .from('users')
    .select('name, nylas_scheduler_config_id')
    .like('booking_page_url', `%/book/${slug}`)
    .eq('status', 'ACTIVE')
    .single();

  if (!tutor?.nylas_scheduler_config_id) notFound();

  return (
    <BookingPage
      configId={tutor.nylas_scheduler_config_id}
      tutorName={tutor.name ?? 'Your Tutor'}
    />
  );
}
