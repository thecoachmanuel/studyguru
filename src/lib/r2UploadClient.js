/**
 * Unified Client Upload Helper
 * Automatically uploads to Cloudinary (or local storage) via /api/upload,
 * eliminating the need for Cloudflare R2 credentials.
 */
export async function uploadToStorage(file, prefix = 'studycord/docs') {
  if (!file) throw new Error('No file provided for upload.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('prefix', prefix);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload file');
  }

  const data = await res.json();
  return {
    fileUrl: data.url,
    key: data.public_id || data.url,
    filename: data.file_name || file.name,
    size: data.file_size || file.size,
    type: data.file_type || file.type,
    provider: data.provider,
  };
}

// Retain uploadToR2 alias for existing pipeline compatibility
export const uploadToR2 = uploadToStorage;
