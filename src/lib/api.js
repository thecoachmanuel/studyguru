export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Standard same-origin authenticated fetch for Next.js
 */
export async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;

  let body = options.body;
  if (!isFormData && !isBlob && body && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;

  const response = await fetch(url, {
    ...options,
    body,
    headers: {
      ...(!isFormData && !isBlob && body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error || data?.detail || data?.message || 'Request failed.', response.status, data);
  }

  return data;
}

export async function apiBlobRequest(path, options = {}) {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || 'Request failed', response.status);
  }
  return response.blob();
}
