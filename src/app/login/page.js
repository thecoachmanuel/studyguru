'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import Seo from '@/components/Seo';

const LOGIN_SEO = {
  title: 'Login – StudyCord Quiz Arena',
  description: 'Sign in to StudyCord Quiz Arena, your real-time student collaboration, live quizzes, and AI study group network.',
  path: '/login',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loadingLogin, setLoadingLogin] = useState(false);
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

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (loadingLogin || loadingGoogle) return;
    setError(null);
    setLoadingLogin(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        // Clear guest flag upon successful real login
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('studycord_guest');
          localStorage.removeItem('studycord_guest');
        }
        router.push(targetDashboard);
        router.refresh();
      }
    } catch {
      setError('Unable to reach authentication service. Please check your connection.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loadingLogin || loadingGoogle) return;
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

  const handleFillDemo = () => {
    setEmail('demo@studycord.me');
    setPassword('StudyCord2026!');
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
        <Seo {...LOGIN_SEO} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="chatter-logo-tag" style={{ fontSize: 30, gap: 8 }}>
            <span>Study<span style={{ color: '#c564bb' }}>Cord</span></span>
            <span className="chatter-logo-tag__dot" style={{ width: 9, height: 9, background: '#c564bb' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#bbb', fontSize: 15 }}>
            <span style={{ animation: 'spin 1s linear infinite' }}>⚡</span>
            <span>Entering study lounge & quiz arena…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-auth-page">
      <Seo {...LOGIN_SEO} />

      {/* Main Glassmorphic Card (Elite Quiz morphisam layout) */}
      <div className="elite-auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, background: 'rgba(197, 100, 187, 0.12)', border: '1px solid rgba(197, 100, 187, 0.25)', marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: '#c564bb', fontWeight: 800, letterSpacing: '0.04em' }}>🏆 QUIZ ARENA & CAMPUS</span>
          </div>
          <h1 className="elite-auth-headline">Login</h1>
          <p style={{ fontSize: 14.5, color: '#918ea0', margin: 0, fontWeight: 500 }}>
            Welcome back! Sign in to access your study space & battle quizzes.
          </p>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle || loadingLogin}
          className="elite-google-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>{loadingGoogle ? 'Connecting…' : 'Login with Google'}</span>
        </button>

        {/* Separator Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
          <span style={{ fontSize: 13, color: '#918ea0', fontWeight: 500, letterSpacing: '0.01em' }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Error Alert */}
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

        {/* Credentials Form */}
        <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Email Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
              disabled={loadingLogin || loadingGoogle}
              className="elite-input"
            />
          </div>

          {/* Password Input */}
          <div className="elite-input-wrapper">
            <span className="elite-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loadingLogin || loadingGoogle}
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 4 }}>
            <Link href="/forgot-password" style={{ fontSize: 13.5, color: '#c564bb', textDecoration: 'none', fontWeight: 600 }}>
              Forgot Password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loadingLogin || loadingGoogle || !email.trim() || !password}
            className="elite-btn-primary"
            style={{
              opacity: loadingLogin || !email.trim() || !password ? 0.65 : 1,
              cursor: loadingLogin || !email.trim() || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingLogin ? 'Please wait…' : 'Login'}
          </button>

          {/* Quick Demo Fill Pill */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(197, 100, 187, 0.08)',
              border: '1px solid rgba(197, 100, 187, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              color: '#d1cedb',
            }}
          >
            <span>⚡ Quick Demo: <strong>demo@studycord.me</strong></span>
            <button
              type="button"
              onClick={handleFillDemo}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: '#c564bb',
                border: 'none',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fill
            </button>
          </div>
        </form>

        {/* Guest Scholar Exploration Button */}
        <div style={{ margin: '20px 0 6px 0' }}>
          <button
            type="button"
            onClick={handleGuestLogin}
            className="elite-btn-guest"
          >
            <span>🚀 Explore Platform as Guest Scholar</span>
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#7b788c', margin: '7px 0 0 0' }}>
            No account required • Browse Quiz Arena, study feeds & preview Guru
          </p>
        </div>

        {/* Footer Link */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14.5, color: '#918ea0', marginBottom: 0 }}>
          Don&apos;t have an account?{' '}
          <Link
            href={joinRoom ? `/signup?joinRoom=${encodeURIComponent(joinRoom)}` : '/signup'}
            style={{ color: '#c564bb', textDecoration: 'none', fontWeight: 700 }}
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
