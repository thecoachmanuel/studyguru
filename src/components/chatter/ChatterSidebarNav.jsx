'use client';

import ThemeToggle from '@/components/ThemeToggle';
import EliteIcon from '@/components/elite/EliteIcon';

export default function ChatterSidebarNav({
  activeTab = 'quiz',
  onSelectTab,
  profile,
  unreadChatsCount = 0,
  activeVoiceChannelName = null,
  isJoinedInVoiceRoom = false,
  onLeaveVoice,
  onOpenVoice,
  onOpenSettings,
  onLogout,
}) {
  const tabs = [
    {
      id: 'quiz',
      label: 'Home Arena',
      iconName: 'home',
    },
    {
      id: 'feed',
      label: 'Community Feed',
      customIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary-color)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
    {
      id: 'guru',
      label: 'AI Guru',
      customIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary-color)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          <circle cx="12" cy="12" r="4" fill={active ? 'var(--primary-color)' : 'none'} />
        </svg>
      ),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      iconName: 'leaderboard',
    },
    {
      id: 'rooms',
      label: 'Study Rooms',
      customIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary-color)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'chats',
      label: 'Chats & DMs',
      hasBadge: unreadChatsCount > 0,
      customIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary-color)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'My Profile',
      iconName: 'profile',
    },
  ];

  return (
    <aside
      className="chatter-desktop-sidebar"
      aria-label="Desktop Main Navigation"
      style={{
        width: 250,
        backgroundColor: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 16px',
        boxSizing: 'border-box',
        height: '100dvh',
        overflowY: 'auto',
      }}
    >
      <div>
        {/* Brand Header */}
        <div style={{ padding: '4px 8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 83, 136, 0.35)',
              }}
            >
              <EliteIcon name="home" size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Elite<span style={{ color: 'var(--primary-color)' }}>Quiz</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                StudyCord
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 14.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22 }}>
                  {tab.iconName ? (
                    <EliteIcon
                      name={tab.iconName}
                      active={isActive}
                      size={20}
                      color={isActive ? 'var(--primary-color)' : 'var(--text-secondary)'}
                    />
                  ) : (
                    tab.customIcon?.(isActive)
                  )}
                </div>

                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tab.label}
                </span>

                {tab.hasBadge && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--error-color)',
                      boxShadow: '0 0 0 2px var(--card)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Footer (Active Space indicator + User Account Card) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isJoinedInVoiceRoom && (
          <div
            onClick={onOpenVoice}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--accent-border)',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: onOpenVoice ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 11, color: 'var(--primary-color)', fontWeight: 800, textTransform: 'uppercase' }}>
                  Connected Space
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600 }}>
                  {activeVoiceChannelName || 'Study Room'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLeaveVoice?.();
              }}
              style={{
                background: 'rgba(255, 97, 105, 0.15)',
                border: 'none',
                color: 'var(--error-color)',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Leave
            </button>
          </div>
        )}

        {/* User Mini Profile Card */}
        <div
          onClick={() => onSelectTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid var(--primary-color)',
              overflow: 'hidden',
              flexShrink: 0,
              backgroundColor: 'var(--background)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src="/elite_assets/config/profile/1.svg" alt="Avatar" style={{ width: 28, height: 28 }} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.name || 'Scholar'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <EliteIcon name="coin" size={12} color="var(--accent-amber)" />
              <span style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>{profile?.coins || 100}</span> coins
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
