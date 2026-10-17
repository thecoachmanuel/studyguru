'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import Seo from '@/components/Seo';

const SIGNUP_SEO = {
  title: 'Sign Up – StudyCord Quiz Arena',
  description: 'Create an account on StudyCord Quiz Arena, your student collaboration, live battle quizzes, and AI study group network.',
  path: '/signup',
};

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [hasSessionHint, setHasSessionHint] = useState(false);

  const router = useRouter();
  const { data: session, status } = useSession();
  const [joinRoom, setJoinRoom] = useState('');

  // Detect existing session cookie & read joinRoom parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cookies = document.cookie || '';
      if (cookies.includes('session-token') || cookies.includes('authjs') || cookies.includes('next-auth')) {
        setHasSessionHint(true);
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinRoom') || '';
      if (code) setJoinRoom(code);
    }
  }, []);

  const targetDashboard = joinRoom ? `/dashboard?joinRoom=${encodeURIComponent(joinRoom)}` : '/dashboard';

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push(targetDashboard);
    }
  }, [session, status, router, targetDashboard]);

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    if (loadingSignup || loadingGoogle) return;
    setError(null);
    setSuccess(false);

    if (!agreeTerms) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not create account. Please try again.');
      }

      // Automatically sign in upon successful registration
      const loginResult = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        setSuccess(true);
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('studycord_guest');
          localStorage.removeItem('studycord_guest');
        }
        router.push(targetDashboard);
        router.refresh();
      }
    } catch (err) {
      setError(err.message || 'Unable to complete registration. Please try again.');
    } finally {
      setLoadingSignup(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (loadingSignup || loadingGoogle) return;
    setError(null);
    setLoadingGoogle(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('studycord_guest');
        localStorage.removeItem('studycord_guest');
      }
      await signIn('google', { callbackUrl: targetDashboard });
    } catch {
      setError('Unable to connect with Google. Please try again.');
      setLoadingGoogle(false);
    }
  };

  const handleGuestLogin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('studycord_guest', '1');
      localStorage.setItem('studycord_guest', '1');
    }
    router.push('/dashboard?guest=1');
  };

  if (status === 'authenticated' || (status === 'loading' && hasSessionHint)) {
    return (
      <div
        className="elite-auth-page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Seo {...SIGNUP_SEO} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="chatter-logo-tag" style={{ fontSize: 30, gap: 8 }}>
            <span>Study<span style={{ color: '#c564bb' }}>Cord</span></span>
            <span className="chatter-logo-tag__dot" style={{ width: 9, height: 9, background: '#c564bb' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#bbb', fontSize: 15 }}>
            <span style={{ animation: 'spin 1s linear infinite' }}>✨</span>
            <span>Setting up your scholar account…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-auth-page">
      <Seo {...SIGNUP_SEO} />
      {/* Main Glassmorphic Card (Elite Quiz Mobile & Web Layout) */}
      <div className="elite-auth-card">
        {/* Back Button */}
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              padding: 0,
            }}
          >
            <span>←</span> Back
          </button>
        </div>

        {/* Elite Quiz App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
            Sign Up
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
            Create an account to join the Quiz Arena and compete with scholars
          </p>
        </div>

        {/* Error Alert */}
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

        {/* Success Alert */}
        {success && (
          <div
            style={{
              padding: '11px 14px',
              borderRadius: 10,
              background: 'rgba(93, 183, 96, 0.15)',
              border: '1px solid rgba(93, 183, 96, 0.35)',
              color: 'var(--correct-color)',
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Account created! <Link href="/login" style={{ color: 'var(--primary-color)', fontWeight: 800 }}>Click here to log in</Link>.
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Full Name Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Full Name / Scholar Alias"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loadingSignup || loadingGoogle}
              className="elite-input"
            />
          </div>

          {/* Email Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loadingSignup || loadingGoogle}
              className="elite-input"
            />
          </div>

          {/* Password Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loadingSignup || loadingGoogle}
              className="elite-input"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="elite-password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* Confirm Password Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loadingSignup || loadingGoogle}
              className="elite-input"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="elite-password-toggle"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* User Agreement Checkbox (Matching Elite Quiz) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '2px 0 6px 0' }}>
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{
                accentColor: 'var(--primary-color)',
                width: 17,
                height: 17,
                cursor: 'pointer',
                marginTop: 2,
              }}
            />
            <label htmlFor="agree-terms" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4, cursor: 'pointer' }}>
              I agree to the{' '}
              <Link href="/terms" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
                Privacy Policy
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loadingSignup || loadingGoogle || !email.trim() || !password || !confirmPassword || !agreeTerms}
            className="elite-btn-primary"
            style={{
              opacity: loadingSignup || !email.trim() || !password || !confirmPassword || !agreeTerms ? 0.65 : 1,
              cursor: loadingSignup || !email.trim() || !password || !confirmPassword || !agreeTerms ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingSignup ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        {/* Separator Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>OR SIGN UP WITH</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Social / Guest Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loadingGoogle || loadingSignup}
            className="elite-google-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>{loadingGoogle ? 'Connecting…' : 'Sign up with Google'}</span>
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="elite-btn-guest"
          >
            <span>🎮 Play as Guest (Explore Quiz Arena)</span>
          </button>
        </div>

        {/* Footer Link */}
        <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14, color: 'var(--text-muted)', marginBottom: 0 }}>
          Already have an account?{' '}
          <Link
            href={joinRoom ? `/login?joinRoom=${encodeURIComponent(joinRoom)}` : '/login'}
            style={{ color: 'var(--primary-color)', textDecoration: 'underline', fontWeight: 800 }}
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
