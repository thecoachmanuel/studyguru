'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import Seo from '@/components/Seo';

const LOGIN_SEO = {
  title: 'Sign In – StudyCord',
  description: 'Sign in to StudyCord, your real-time student collaboration and study group network.',
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
      await signIn('google', { callbackUrl: targetDashboard });
    } catch {
      setError('Unable to connect with Google. Please try again.');
      setLoadingGoogle(false);
    }
  };

  if (status === 'authenticated' || (status === 'loading' && hasSessionHint)) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#0E0E0E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        <Seo {...LOGIN_SEO} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="chatter-logo-tag" style={{ fontSize: 28, gap: 7 }}>
            <span>Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span></span>
            <span className="chatter-logo-tag__dot" style={{ width: 8, height: 8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 14 }}>
            <span>Entering study lounge…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#0E0E0E',
        backgroundImage: 'radial-gradient(circle at 50% 12%, rgba(64, 227, 120, 0.08) 0%, transparent 60%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        color: '#fff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <Seo {...LOGIN_SEO} />

      {/* Main Flutter Chatter Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#141414',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          padding: '36px 28px',
          boxSizing: 'border-box',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <div className="chatter-logo-tag" style={{ fontSize: 28, gap: 7 }}>
              <span>Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span></span>
              <span className="chatter-logo-tag__dot" style={{ width: 8, height: 8 }} />
            </div>
          </div>
          <p style={{ fontSize: 14.5, color: '#888', margin: 0, fontWeight: 500 }}>
            Welcome back! Sign in to your study space.
          </p>
        </div>

        {/* Google One-Tap / Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle || loadingLogin}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'background 0.15s ease',
            marginBottom: 20,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>{loadingGoogle ? 'Connecting…' : 'Continue with Google'}</span>
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
          <span style={{ fontSize: 12.5, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>or email</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 14,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#bbb', display: 'block', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loadingLogin || loadingGoogle}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#40e378')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#bbb' }}>Password</label>
              <Link href="/forgot" style={{ fontSize: 14, color: '#40e378', textDecoration: 'none', fontWeight: 600 }}>
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loadingLogin || loadingGoogle}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#40e378')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingLogin || loadingGoogle || !email.trim() || !password}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              background: '#40e378',
              border: 'none',
              color: '#0E0E0E',
              fontSize: 15.5,
              fontWeight: 800,
              cursor: loadingLogin || !email.trim() || !password ? 'not-allowed' : 'pointer',
              opacity: loadingLogin || !email.trim() || !password ? 0.6 : 1,
              marginTop: 6,
              transition: 'transform 0.12s ease',
            }}
          >
            {loadingLogin ? 'Signing in…' : 'Sign In'}
          </button>

          {/* Quick Demo Credentials Pill */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(64, 227, 120, 0.08)',
              border: '1px solid rgba(64, 227, 120, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              color: '#bbb',
            }}
          >
            <span>⚡ Demo: <strong>demo@studycord.me</strong></span>
            <button
              type="button"
              onClick={() => {
                setEmail('demo@studycord.me');
                setPassword('StudyCord2026!');
              }}
              style={{
                padding: '3px 8px',
                borderRadius: 8,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Fill
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14.5, color: '#888' }}>
          Don&apos;t have an account?{' '}
          <Link href={joinRoom ? `/signup?joinRoom=${encodeURIComponent(joinRoom)}` : '/signup'} style={{ color: '#40e378', textDecoration: 'none', fontWeight: 700 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
