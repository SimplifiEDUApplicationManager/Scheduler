import { NextResponse } from 'next/server';
import { requireActiveRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * POST /api/tutor/photo
 * Accepts multipart FormData with a `file` field.
 * Uploads to Supabase Storage (avatars bucket), updates users.photo_url,
 * and returns { photoUrl: string }.
 */
export async function POST(request: Request) {
  const auth = await requireActiveRole(['TUTOR', 'COORDINATOR', 'SUPER_ADMIN']);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 });
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const storagePath = `${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  // Use service client so storage RLS doesn't block the upload
  const service = createServiceClient();

  const { error: uploadError } = await service.storage
    .from('avatars')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = service.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  // Bust the browser cache by appending a timestamp so the new photo shows immediately
  const photoUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await service
    .from('users')
    .update({ photo_url: photoUrl })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ photoUrl });
}
