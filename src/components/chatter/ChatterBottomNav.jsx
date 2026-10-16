'use client';

export default function ChatterBottomNav({
  activeTab = 'feed',
  onSelectTab,
  unreadChatsCount = 0,
  isHidden = false,
}) {
  const tabs = [
    {
      id: 'feed',
      label: 'Feed',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
    {
      id: 'rooms',
      label: 'Rooms',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      isAi: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
          <path d="M4 17v2" />
          <path d="M5 18H3" />
        </svg>
      ),
    },
    {
      id: 'chats',
      label: 'Chats',
      hasBadge: unreadChatsCount > 0,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  if (isHidden) return null;

  return (
    <nav
      className="chatter-tabbar"
      aria-label="Chatter Bottom Navigation"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isAi = Boolean(tab.isAi);
        return (
          <button
            key={tab.id}
            type="button"
            className={`chatter-tabbar__item ${isAi ? 'chatter-tabbar__item--ai' : ''} ${isActive ? 'chatter-tabbar__item--active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            aria-label={tab.label}
          >
            <div
              className={`chatter-tabbar__icon ${isAi ? 'chatter-tabbar__icon--ai' : ''}`}
              style={isAi ? {
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: isActive
                  ? 'var(--chatter-primary)'
                  : 'linear-gradient(135deg, rgba(64, 227, 120, 0.22), rgba(59, 130, 246, 0.22))',
                color: isActive ? '#0E0E0E' : 'var(--chatter-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isActive
                  ? '0 2px 14px rgba(64, 227, 120, 0.5)'
                  : '0 2px 10px rgba(64, 227, 120, 0.25)',
                border: '1.5px solid var(--chatter-primary)',
                transition: 'all 0.18s ease',
              } : undefined}
            >
              {tab.icon}
              {tab.hasBadge && <span className="chatter-tabbar__badge" />}
            </div>
            <span
              className="chatter-tabbar__label"
              style={isAi ? { color: isActive ? 'var(--chatter-primary)' : 'var(--chatter-light-text)', fontWeight: 700 } : undefined}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
