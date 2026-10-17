'use client';

import { useState } from 'react';
import Link from 'next/link';
import Seo from '@/components/Seo';
import { isValidEmail } from '@/lib/authFlow';

const SEO = {
  title: 'Reset Password – StudyCord Quiz Arena',
  description: 'Reset your password for StudyCord Quiz Arena.',
  path: '/forgot-password',
};

const NEUTRAL_SUCCESS = 'If an account exists for this email, password reset instructions have been sent.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setPending(true);
    try {
      // Future reset API call hook
      setSent(true);
    } catch {
      setError('Unable to send reset instructions right now. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="elite-auth-page">
      <Seo {...SEO} />
      <div className="elite-auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: 'rgba(197, 100, 187, 0.12)', border: '1px solid rgba(197, 100, 187, 0.25)', marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: '#c564bb', fontWeight: 800, letterSpacing: '0.04em' }}>🔐 ACCOUNT RECOVERY</span>
          </div>
          <h1 className="elite-auth-headline">Reset Password</h1>
          <p style={{ fontSize: 14.5, color: '#918ea0', margin: 0, fontWeight: 500 }}>
            Enter your email to receive recovery instructions.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '11px 14px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: 14,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        {sent ? (
          <div
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'rgba(197, 100, 187, 0.12)',
              border: '1px solid rgba(197, 100, 187, 0.3)',
              color: '#d1cedb',
              fontSize: 14.5,
              lineHeight: 1.5,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📬</div>
            {NEUTRAL_SUCCESS}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="elite-input-wrapper">
              <span className="elite-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={pending}
                className="elite-input"
              />
            </div>

            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="elite-btn-primary"
              style={{
                opacity: pending || !email.trim() ? 0.65 : 1,
                cursor: pending || !email.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Sending…' : 'Send Instructions'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/login" style={{ fontSize: 14, color: '#c564bb', textDecoration: 'none', fontWeight: 700 }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
