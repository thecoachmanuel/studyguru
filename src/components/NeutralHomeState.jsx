'use client';

import Link from 'next/link';
import AuthCharacters from './AuthCharacters';

const CAPABILITIES = [
  {
    icon: 'collaborate',
    title: 'Chat & Collaborate',
    description: 'Message your study group and connect through voice, video, and screen sharing.',
  },
  {
    icon: 'resources',
    title: 'Share Resources',
    description: 'Keep study materials together and accessible within your study group.',
  },
  {
    icon: 'search',
    title: 'Search Smarter',
    description: 'Find relevant shared resources by meaning using Advanced Search.',
  },
  {
    icon: 'study',
    title: 'Study with AI',
    description: 'Turn study materials into Q&A, summaries, flashcards, and revision quizzes.',
  },
];

export default function NeutralHomeState({
  profile,
  userEmail,
  onCreateServer,
  onJoinServer,
}) {
  const username = profile?.username?.trim()
    || userEmail?.split('@')[0]
    || 'there';

  return (
    <div className="neutral-home">
      <div className="neutral-home__content">
        <section className="neutral-home__welcome" aria-labelledby="neutral-home-title">
          <div className="neutral-home__welcome-copy">
            <p className="neutral-home__eyebrow">StudyCord home</p>
            <h1 id="neutral-home-title">Welcome back, {username}</h1>
            <p className="neutral-home__intro">
              Ready when you are. Choose a study space from the left to get started.
            </p>

            <div className="neutral-home__actions">
              <button
                type="button"
                className="neutral-home__action neutral-home__action--primary"
                onClick={onCreateServer}
              >
                <PlusIcon />
                Create group
              </button>
              <button
                type="button"
                className="neutral-home__action"
                onClick={onJoinServer}
              >
                <JoinIcon />
                Join group
              </button>
            </div>
          </div>

          <div className="neutral-home__mascot" aria-hidden="true">
            <AuthCharacters />
          </div>
        </section>

        {/* Quick Social & Study Pulse Bar */}
        <section style={{ margin: '20px 0 28px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
            }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'var(--accent-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                📚
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Study Focus
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Set your study status to let friends know
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(236, 72, 153, 0.1)',
                  color: '#ec4899',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                📸
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Study Snapshots
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Share 24h progress &amp; notes with groups
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                ⚡
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  AI Study Tools
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Q&amp;A, flashcards, &amp; quizzes on demand
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="neutral-home__capabilities" aria-labelledby="neutral-home-capabilities">
          <h2 id="neutral-home-capabilities">What you can do</h2>
          <div className="neutral-home__capability-grid">
            {CAPABILITIES.map((capability) => (
              <article className="neutral-home__capability" key={capability.title}>
                <div className="neutral-home__capability-icon" aria-hidden="true">
                  <CapabilityIcon name={capability.icon} />
                </div>
                <div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="neutral-home__workflow" aria-label="Getting started workflow">
          <span>Select a group</span>
          <span aria-hidden="true">→</span>
          <span>Choose a channel</span>
          <span aria-hidden="true">→</span>
          <span>Start studying</span>
        </div>

        <footer className="neutral-home__footer">
          <nav className="neutral-home__footer-links" aria-label="StudyCord information">
            <Link href="/about">About</Link>
            <Link href="/features">Features</Link>
            <Link href="/technology">Technology</Link>
            <Link href="/faq">FAQ</Link>
          </nav>
          <nav
            className="neutral-home__footer-links neutral-home__footer-links--legal"
            aria-label="Legal"
          >
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <p className="neutral-home__footer-copyright">© 2026 StudyCord</p>
          <p className="neutral-home__footer-subtitle">
            AI-Powered Student Collaboration Platform
          </p>
        </footer>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function JoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function CapabilityIcon({ name }) {
  if (name === 'collaborate') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.7V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4Z" />
        <path d="M7 9h10M7 13h6" />
      </svg>
    );
  }
  if (name === 'resources') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H3Z" />
      <path d="M21 5h-6a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h6Z" />
    </svg>
  );
}
