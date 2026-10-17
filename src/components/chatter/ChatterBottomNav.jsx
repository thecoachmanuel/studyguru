'use client';

import EliteIcon from '@/components/elite/EliteIcon';

export default function ChatterBottomNav({
  activeTab = 'quiz',
  onSelectTab,
  unreadChatsCount = 0,
  isHidden = false,
}) {
  const tabs = [
    {
      id: 'quiz',
      label: 'Home',
      iconName: 'home',
    },
    {
      id: 'feed',
      label: 'Feed',
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
      label: 'Rankings',
      iconName: 'leaderboard',
    },
    {
      id: 'chats',
      label: 'Chats',
      hasBadge: unreadChatsCount > 0,
      customIcon: (active) => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--primary-color)' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      iconName: 'profile',
    },
  ];

  if (isHidden) return null;

  return (
    <nav
      className="chatter-tabbar"
      aria-label="Elite Quiz & StudyCord Navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.05)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 4,
        paddingRight: 4,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`chatter-tabbar__item ${isActive ? 'chatter-tabbar__item--active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 2px',
              color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
              position: 'relative',
              minWidth: 0,
            }}
          >
            <div
              className="chatter-tabbar__icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                transition: 'transform 0.15s ease',
              }}
            >
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

              {tab.hasBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: 'var(--error-color)',
                    boxShadow: '0 0 0 2px var(--card)',
                  }}
                />
              )}
            </div>

            <span
              className="chatter-tabbar__label"
              style={{
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {tab.label}
            </span>

            {/* Subtle active indicator dot matching Elite style */}
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color)',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
