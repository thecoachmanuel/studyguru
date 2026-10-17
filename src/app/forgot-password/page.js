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
        {/* Back Button */}
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/login"
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span>←</span> Back to Login
          </Link>
        </div>

        {/* Elite Quiz App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
            <img
              src="/elite_assets/config/app_logo.svg"
              alt="Elite Quiz Logo"
              style={{ width: 145, height: 'auto', display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="elite-auth-headline">
            Reset Password
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            Enter your email to receive recovery instructions
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '11px 14px',
              borderRadius: 10,
              background: 'rgba(255, 97, 105, 0.12)',
              border: '1px solid rgba(255, 97, 105, 0.35)',
              color: 'var(--wrong-color)',
              fontSize: 13.5,
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
              padding: '16px',
              borderRadius: 12,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📬</div>
            {NEUTRAL_SUCCESS}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="elite-input-wrapper">
              <span className="elite-input-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <Link href="/login" style={{ fontSize: 14, color: 'var(--primary-color)', textDecoration: 'underline', fontWeight: 800 }}>
            Login to your account
          </Link>
        </div>
      </div>
    </div>
  );
}
