import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadTutorPhoto } from '@/lib/utils/uploadTutorPhoto';

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

describe('uploadTutorPhoto', () => {
  it('returns photoUrl on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ photoUrl: 'https://example.com/avatar.jpg' }),
    });

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const url = await uploadTutorPhoto(file);

    expect(url).toBe('https://example.com/avatar.jpg');
    expect(mockFetch).toHaveBeenCalledWith('/api/tutor/photo', expect.objectContaining({ method: 'POST' }));
  });

  it('throws with server error message on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'File must be under 5 MB' }),
    });

    const file = new File(['data'], 'big.jpg', { type: 'image/jpeg' });
    await expect(uploadTutorPhoto(file)).rejects.toThrow('File must be under 5 MB');
  });

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(uploadTutorPhoto(file)).rejects.toThrow('Upload failed');
  });

  it('throws connection error message on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(uploadTutorPhoto(file)).rejects.toThrow();
  });
});
