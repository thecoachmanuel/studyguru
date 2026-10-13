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

const SUGGESTED_SUBJECTS = ['Computer Science', 'Mathematics', 'Data Structures', 'Algorithms', 'Physics', 'Psychology'];

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;

  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({
    username: '',
    full_name: '',
    bio: '',
    email: '',
    status_text: '',
    subjects: ['Computer Science', 'Mathematics'],
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (user) {
      setProfile({
        username: user.name || user.email?.split('@')[0] || 'Student',
        full_name: user.name || '',
        bio: 'Student at StudyGuru passionate about collaborative learning.',
        email: user.email || '',
        status_text: 'Studying for upcoming exams 📚',
        subjects: ['Computer Science', 'Mathematics'],
      });
    }
  }, [status, user, router]);

  const handleToggleSubject = (subject) => {
    setProfile((prev) => {
      const exists = prev.subjects.includes(subject);
      const nextSubjects = exists
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects: nextSubjects };
    });
  };

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
            maxWidth: '520px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '32px 28px',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Cover Banner */}
          <div className="profile-cover-banner">
            <div className="profile-avatar-overlay">
              {profile.username?.[0]?.toUpperCase() || 'S'}
            </div>
          </div>

          <div style={{ marginTop: '38px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 2px', color: 'var(--text-primary)' }}>
                  {profile.username || 'Scholar'}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {profile.email || 'scholar@studyguru.me'}
                </p>
              </div>
              <span className="user-status-tag">
                🟢 Online
              </span>
            </div>
          </div>

          {/* Study Stats Row */}
          <div className="profile-stats-row">
            <div className="profile-stat-box">
              <div className="profile-stat-box__num">4</div>
              <div className="profile-stat-box__label">Study Groups</div>
            </div>
            <div className="profile-stat-box">
              <div className="profile-stat-box__num">18</div>
              <div className="profile-stat-box__label">Resources</div>
            </div>
            <div className="profile-stat-box">
              <div className="profile-stat-box__num">24d</div>
              <div className="profile-stat-box__label">Streak</div>
            </div>
          </div>

          {success && (
            <div className="cogni-alert cogni-alert--success" style={{ marginBottom: '20px' }}>
              ✓ Profile settings updated successfully!
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Username */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-username">
                Display Name
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

            {/* Status text */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-status">
                Study Status
              </label>
              <input
                id="profile-status"
                className="cogni-input"
                type="text"
                value={profile.status_text}
                onChange={(e) => setProfile({ ...profile, status_text: e.target.value })}
                placeholder="What are you working on right now?"
              />
            </div>

            {/* Bio */}
            <div className="cogni-form-group">
              <label className="cogni-form-label" htmlFor="profile-bio">
                About / Bio
              </label>
              <textarea
                id="profile-bio"
                className="cogni-input"
                rows={2}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Study Subjects / Interests */}
            <div className="cogni-form-group">
              <label className="cogni-form-label">
                Study Subjects &amp; Interests
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {SUGGESTED_SUBJECTS.map((subj) => {
                  const isSelected = profile.subjects.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleToggleSubject(subj)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                        color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected ? `✓ ${subj}` : `+ ${subj}`}
                    </button>
                  );
                })}
              </div>
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
