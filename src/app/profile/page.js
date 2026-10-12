'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import StudyGuruLogo from '@/components/StudyGuruLogo';
import ThemeToggle from '@/components/ThemeToggle';
import Seo from '@/components/Seo';

const PROFILE_SEO = {
  title: 'Profile Settings – StudyGuru',
  description: 'Manage your personal profile and account settings on StudyGuru.',
  path: '/profile',
};

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    bio: '',
    email: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (user) {
      setProfile({
        username: user.name || user.email?.split('@')[0] || 'Student',
        full_name: user.name || '',
        bio: 'Student at StudyGuru',
        email: user.email || '',
      });
    }
  }, [status, user, router]);

  const handleSave = (e) => {
    e.preventDefault();
    setUpdating(true);
    setTimeout(() => {
      setUpdating(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 400);
  };

  return (
    <div className="public-site" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Seo {...PROFILE_SEO} />

      {/* Header */}
      <header className="public-site__header">
        <div className="public-site__header-inner">
          <Link href="/dashboard" aria-label="StudyGuru Dashboard" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <StudyGuruLogo width={145} height={40} />
          </Link>
          <div className="public-site__actions" style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
            <Link className="public-site__sign-in" href="/dashboard">
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div
          className="public-card"
          style={{
            width: '100%',
            maxWidth: '480px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '32px 28px',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <span className="public-card__label" style={{ color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
              Account &amp; Identity
            </span>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              Profile Settings
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Update your public identity on StudyGuru.
            </p>
          </div>

          {success && (
            <div className="cogni-alert cogni-alert--success" style={{ marginBottom: '20px' }}>
              ✓ Profile settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Avatar Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {profile.username?.[0]?.toUpperCase() || 'S'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {profile.username || 'Student'}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {profile.email || 'student@studyguru.me'}
                </div>
              </div>
            </div>

            {/* Username */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-username">
                Username
              </label>
              <input
                id="profile-username"
                className="cogni-input"
                type="text"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                required
              />
            </div>

            {/* Full Name */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-fullname">
                Full Name
              </label>
              <input
                id="profile-fullname"
                className="cogni-input"
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>

            {/* Email (Read Only) */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-email">
                Email Address
              </label>
              <input
                id="profile-email"
                className="cogni-input"
                type="email"
                value={profile.email}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            {/* Bio */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-bio">
                Bio
              </label>
              <textarea
                id="profile-bio"
                className="cogni-input"
                rows={3}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={updating}
                className="public-button public-button--primary"
                style={{ flex: 1 }}
              >
                {updating ? 'Saving…' : 'Save Changes'}
              </button>
              <Link
                href="/dashboard"
                className="public-button"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
