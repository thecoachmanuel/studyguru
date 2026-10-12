'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import Seo from '@/components/Seo';
import ThemeToggle from '@/components/ThemeToggle';
import StudyGuruLogo from '@/components/StudyGuruLogo';

const SIGNUP_SEO = {
  title: 'Sign Up – StudyGuru',
  description: 'Create an account on StudyGuru, your AI-powered student collaboration platform.',
  path: '/signup',
};

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    if (loadingSignup || loadingGoogle) return;
    setError(null);
    setSuccess(false);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoadingSignup(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not create account. Please try again.');
      }

      // Automatically sign in
      const loginResult = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setSuccess(true);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'Unable to reach the authentication service. Please try again.');
    } finally {
      setLoadingSignup(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (loadingSignup || loadingGoogle) return;
    setError(null);
    setLoadingGoogle(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Unable to start Google sign up. Please try again.');
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="cogni-auth-shell">
      <Seo {...SIGNUP_SEO} />

      {/* Floating Theme Switcher */}
      <div className="cogni-auth-theme-floating">
        <ThemeToggle />
      </div>

      {/* ── Left: Form Panel ─────────────────────────────────── */}
      <div className="cogni-auth-form-side">
        <div className="cogni-auth-form-box">
          {/* Header & Logo */}
          <div className="cogni-auth-header">
            <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              <StudyGuruLogo width={180} height={50} />
            </Link>
            <p className="cogni-auth-mobile-tagline">Your personal AI study system.</p>
            <p className="cogni-auth-title">Create your account to get started</p>
          </div>

          {/* Continue with Google */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loadingGoogle || loadingSignup}
              className="cogni-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loadingGoogle ? 'Connecting…' : 'Continue with Google'}
            </button>

            <p className="cogni-auth-disclaimer">
              By continuing you agree to the{' '}
              <Link href="/terms" target="_blank">Terms</Link> and{' '}
              <Link href="/privacy" target="_blank">Privacy Policy</Link>.
            </p>

            <div className="cogni-auth-divider">
              <span>or</span>
            </div>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="cogni-alert cogni-alert--error">
              {error}
            </div>
          )}

          {success && (
            <div className="cogni-alert cogni-alert--success">
              Account created successfully! Please sign in.
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleEmailSignup} className="cogni-form">
            <div className="cogni-form-group">
              <label htmlFor="signup-email" className="cogni-form-label">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loadingSignup || loadingGoogle}
                className="cogni-input"
                autoComplete="email"
              />
            </div>

            <div className="cogni-form-group">
              <label htmlFor="signup-password" className="cogni-form-label">Password</label>
              <div className="cogni-input-wrap">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loadingSignup || loadingGoogle}
                  className="cogni-input cogni-input--password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cogni-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="cogni-form-group">
              <label htmlFor="signup-confirm-password" className="cogni-form-label">Confirm Password</label>
              <div className="cogni-input-wrap">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loadingSignup || loadingGoogle}
                  className="cogni-input cogni-input--password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="cogni-password-toggle"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingSignup || loadingGoogle}
              className="cogni-submit-btn"
            >
              {loadingSignup ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          {/* Footer Switcher */}
          <p className="cogni-auth-footer">
            Already have an account?{' '}
            <Link href="/login" className="cogni-auth-switch-link">
              Sign in
            </Link>
          </p>

          {/* Public Navigation Links down below signup box */}
          <nav className="cogni-auth-nav-links" aria-label="Explore StudyGuru">
            <Link href="/features">Features</Link>
            <span aria-hidden="true">•</span>
            <Link href="/about">About</Link>
            <span aria-hidden="true">•</span>
            <Link href="/faq">FAQ</Link>
          </nav>
        </div>
      </div>

      {/* ── Right: Branded Hero Panel (Desktop only) ───────────── */}
      <div className="cogni-auth-brand-side">
        {/* Abstract decorative ambient orbs */}
        <div className="cogni-brand-orb cogni-brand-orb--1" />
        <div className="cogni-brand-orb cogni-brand-orb--2" />
        <div className="cogni-brand-orb cogni-brand-orb--3" />

        <div className="cogni-brand-content">
          <StudyGuruLogo variant="white" width={240} height={64} />
          <p className="cogni-brand-tagline">
            Your personal AI study system.
          </p>

          <div className="cogni-brand-bullets">
            {[
              'Real-time study channels & group messaging',
              'WebRTC voice, video, and screen sharing',
              'Semantic document search across notes & slides',
              'AI study assistant for Q&A, summaries & quizzes',
            ].map((feature) => (
              <div key={feature} className="cogni-brand-bullet">
                <div className="cogni-brand-bullet-dot" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
