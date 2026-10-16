'use client';

export default function ChatterSidebarNav({
  activeTab = 'feed',
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
      id: 'feed',
      label: 'Feed',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
    {
      id: 'rooms',
      label: 'Study Rooms',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'guru',
      label: 'AI Guru',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: 'chats',
      label: 'Chats',
      hasBadge: unreadChatsCount > 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="chatter-desktop-sidebar" aria-label="Desktop Main Navigation">
      <div>
        {/* Brand Header */}
        <div className="chatter-desktop-brand">
          <div className="chatter-logo-tag" style={{ fontSize: 22, gap: 6 }}>
            <span>Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span></span>
            <span className="chatter-logo-tag__dot" style={{ width: 7, height: 7 }} />
          </div>
        </div>

        {/* 5 Chatter Tabs */}
        <div className="chatter-desktop-nav-group">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`chatter-desktop-nav-btn ${isActive ? 'chatter-desktop-nav-btn--active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.hasBadge && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--chatter-red)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Footer (Voice Session Bar + User Status Card) */}
      <div className="chatter-desktop-footer">
        {/* Active Audio Space indicator if connected */}
        {isJoinedInVoiceRoom && (
          <div
            onClick={onOpenVoice}
            title="Click to return to active study space"
            style={{
              background: 'var(--chatter-audiospace)',
              border: '1px solid rgba(64, 227, 120, 0.35)',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: onOpenVoice ? 'pointer' : 'default',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <span className="chatter-audiospace-live-dot" />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5, color: 'var(--chatter-primary)', fontWeight: 700 }}>
                  CONNECTED TO SPACE
                </div>
                <div style={{ fontSize: 13, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activeVoiceChannelName || 'Audio Room'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLeaveVoice?.();
              }}
              title="Leave Room"
              style={{
                background: 'rgba(255, 57, 57, 0.15)',
                border: 'none',
                color: 'var(--chatter-red)',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* User Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 4px',
          }}
        >
          <div
            onClick={() => onSelectTab('profile')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', overflow: 'hidden' }}
          >
            <div style={{ position: 'relative' }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--chatter-sheet)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--chatter-primary)',
                  }}
                >
                  {profile?.name?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--chatter-primary)',
                  border: '2px solid var(--chatter-black)',
                }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {profile?.name || 'Scholar'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
                @{profile?.username || 'student'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={onOpenSettings}
              title="Settings"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--chatter-light-text)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log Out"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--chatter-light-text)',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--chatter-red)';
                  e.currentTarget.style.background = 'rgba(255, 59, 48, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--chatter-light-text)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
