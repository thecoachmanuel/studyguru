'use client';

import { useState } from 'react';

export default function ChatterProfileView({
  profile,
  onLogout,
  onOpenStatusModal,
  onOpenSettings,
}) {
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'notes' | 'rooms'

  return (
    <div style={{ paddingBottom: 80, maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* ── 1. Cover Banner ── */}
      <div
        style={{
          height: 140,
          background: 'linear-gradient(135deg, #183321 0%, #0E0E0E 100%)',
          position: 'relative',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* ── 2. Profile Details & Avatar ── */}
      <div style={{ padding: '0 20px', position: 'relative', marginTop: -42 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          {/* Avatar with Emerald Ring */}
          <div style={{ position: 'relative' }}>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3.5px solid var(--chatter-black)',
                  boxShadow: '0 0 0 2px var(--chatter-primary)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  background: '#242424',
                  color: 'var(--chatter-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 28,
                  border: '3.5px solid var(--chatter-black)',
                  boxShadow: '0 0 0 2px var(--chatter-primary)',
                }}
              >
                {profile?.name?.[0]?.toUpperCase() || 'S'}
              </div>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--chatter-primary)',
                border: '2.5px solid var(--chatter-black)',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onOpenStatusModal}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Set Status
            </button>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                background: 'rgba(255, 57, 57, 0.15)',
                border: 'none',
                color: 'var(--chatter-red)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* User Info */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 2px 0' }}>
          {profile?.name || 'Scholar'}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginBottom: 8 }}>
          @{profile?.username || 'scholar'} · {profile?.email}
        </div>

        <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          📚 Studying Computer Science & Machine Learning · Always open to collaborate on projects & exam drills!
        </p>

        {/* ── 3. Study Stats Grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>48h</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Study Time</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>14</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Notes Shared</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>7🔥</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Day Streak</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 12, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>26</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Classmates</div>
          </div>
        </div>

        {/* ── 4. Segmented History Tabs ── */}
        <div className="chatter-segment-control" style={{ margin: '0 0 16px 0' }}>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'posts' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            My Posts
          </button>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'notes' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Saved Notes
          </button>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'rooms' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            My Rooms
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--chatter-light-text)', background: 'var(--chatter-sheet)', borderRadius: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📖</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>No recent items in {activeTab}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Activity and resources will be archived here.</div>
        </div>
      </div>
    </div>
  );
}
