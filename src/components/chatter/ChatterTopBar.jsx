'use client';

export default function ChatterTopBar({
  onOpenNotifications,
  onOpenSearch,
  onOpenLiveSpaces,
  onRandomTopic,
  unreadNotificationsCount = 0,
}) {
  return (
    <header className="chatter-topbar" aria-label="StudyCord Top Header">
      <div className="chatter-topbar__actions">
        {/* Notification Bell */}
        <button
          type="button"
          className="chatter-topbar__btn"
          onClick={onOpenNotifications}
          aria-label="Notifications"
          title="Notifications"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadNotificationsCount > 0 && <span className="chatter-topbar__badge" />}
        </button>

        {/* Random / Discover Study Topic */}
        <button
          type="button"
          className="chatter-topbar__btn"
          onClick={onRandomTopic}
          aria-label="Discover Study Groups"
          title="Discover Random Topic"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
        </button>
      </div>

      {/* Center Logo Tag matching Chatter */}
      <div className="chatter-logo-tag">
        <span>Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span></span>
        <span className="chatter-logo-tag__dot" />
      </div>

      <div className="chatter-topbar__actions">
        {/* Live Audio Spaces / Rooms shortcut */}
        <button
          type="button"
          className="chatter-topbar__btn"
          onClick={onOpenLiveSpaces}
          aria-label="Live Audio Study Spaces"
          title="Live Audio Spaces"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Search */}
        <button
          type="button"
          className="chatter-topbar__btn"
          onClick={onOpenSearch}
          aria-label="Search"
          title="Search"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    </header>
  );
}
