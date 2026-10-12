import { signIn } from 'next-auth/react';

export const RECOVERY_STORAGE_KEY = 'studycord.password-recovery';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function getAuthRedirectUrl(pathname) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return new URL(pathname, `${origin}/`).toString();
}

export async function requestPasswordReset(email) {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    });
    return { data: await res.json().catch(() => ({})), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function beginGoogleOAuth() {
  if (typeof window !== 'undefined') {
    return signIn('google', { callbackUrl: '/dashboard' });
  }
}

