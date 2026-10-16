'use client';

export default function ChatterTopBar({
  onOpenNotifications,
  onOpenSearch,
  onOpenLiveSpaces,
  onRandomTopic,
  unreadNotificationsCount = 0,
  feedTab = null,
  onSelectFeedTab = null,
  title = null,
}) {
  return (
    <>
      {/* ── Mobile Brand Header (scrolls with feed, disappears while scrolling) ── */}
      {feedTab && (
        <div className="chatter-mobile-brand-header">
          <div className="chatter-logo-tag" style={{ fontSize: 22, gap: 6 }}>
            <span>Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span></span>
            <span className="chatter-logo-tag__dot" style={{ width: 7, height: 7 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="chatter-topbar__btn"
              onClick={onOpenNotifications}
              aria-label="Notifications"
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadNotificationsCount > 0 && <span className="chatter-topbar__badge" />}
            </button>
            <button
              type="button"
              className="chatter-topbar__btn"
              onClick={onOpenSearch}
              aria-label="Search"
              title="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Top Bar: Tabs ("For you" / "Following") or Section Title ── */}
      <header className="chatter-topbar" aria-label="StudyCord Top Header">
        {/* Left Action: Notifications on mobile & desktop (desktop only on feed since brand header has it) */}
        <div className={`chatter-topbar__actions chatter-topbar__actions--left ${feedTab ? 'chatter-topbar__actions--desktop-only' : ''}`}>
          <button
            type="button"
            className="chatter-topbar__btn"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadNotificationsCount > 0 && <span className="chatter-topbar__badge" />}
          </button>

          <button
            type="button"
            className="chatter-topbar__btn chatter-topbar__btn--desktop-only"
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

        {/* Center Content: Twitter / X Tabs on Feed or Clean Section Title */}
        {feedTab ? (
          <div className="chatter-topbar-tabs">
            <button
              type="button"
              className={`chatter-topbar-tab ${feedTab === 'forYou' ? 'chatter-topbar-tab--active' : ''}`}
              onClick={() => onSelectFeedTab?.('forYou')}
            >
              <span>For you</span>
              {feedTab === 'forYou' && <span className="chatter-topbar-tab__indicator" />}
            </button>
            <button
              type="button"
              className={`chatter-topbar-tab ${feedTab === 'following' ? 'chatter-topbar-tab--active' : ''}`}
              onClick={() => onSelectFeedTab?.('following')}
            >
              <span>Following</span>
              {feedTab === 'following' && <span className="chatter-topbar-tab__indicator" />}
            </button>
          </div>
        ) : title ? (
          <div className="chatter-topbar-title-text" style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', textAlign: 'center' }}>
            {title}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Right Action: Search & Live Spaces (desktop only on feed since brand header has search) */}
        <div className={`chatter-topbar__actions chatter-topbar__actions--right ${feedTab ? 'chatter-topbar__actions--desktop-only' : ''}`}>
          <button
            type="button"
            className="chatter-topbar__btn chatter-topbar__btn--desktop-only"
            onClick={onOpenLiveSpaces}
            aria-label="Live Audio Study Spaces"
            title="Live Audio Spaces"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <button
            type="button"
            className="chatter-topbar__btn"
            onClick={onOpenSearch}
            aria-label="Search"
            title="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </header>
    </>
  );
}
