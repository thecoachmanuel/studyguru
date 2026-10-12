'use client';

import { useState } from 'react';
import Link from 'next/link';
import EtherealBackground from '@/components/EtherealBackground';
import StudyGuruLogo from '@/components/StudyGuruLogo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;
    setError('');

    if (!password || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setPending(true);
    try {
      setSuccess(true);
    } catch {
      setError('Unable to update your password right now. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <EtherealBackground>
      <main className="auth-recovery-layout">
        <section className="auth-card auth-page-transition" aria-labelledby="reset-password-title">
          <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Link href="/" style={{ display: 'inline-flex', marginBottom: '16px', textDecoration: 'none' }}>
              <StudyGuruLogo width={160} height={44} />
            </Link>
            <h1 className="auth-title" id="reset-password-title">Choose a new password</h1>
            <p className="auth-subtitle">Use a password that meets your existing account requirements.</p>
          </div>

          {success ? (
            <>
              <div className="success-message" role="status">Your password has been updated. Sign in with your new password.</div>
              <Link href="/login" className="btn btn-primary">Return to sign in</Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message" role="alert">{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                {pending ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <Link href="/login" className="auth-link">Back to sign in</Link>
          </div>
        </section>
      </main>
    </EtherealBackground>
  );
}
