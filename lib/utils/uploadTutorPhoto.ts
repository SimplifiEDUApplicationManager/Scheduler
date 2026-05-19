/**
 * Uploads a photo file to the tutor photo API and returns the new photo URL.
 * Throws with a user-readable message on failure.
 */
export async function uploadTutorPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/tutor/photo', { method: 'POST', body: fd });
  const data = await res.json() as { photoUrl?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data.photoUrl!;
}
