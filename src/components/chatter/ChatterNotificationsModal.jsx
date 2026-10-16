'use client';

import React, { useState } from 'react';

/**
 * ChatterNotificationsModal
 * Displays:
 * 1. Ongoing Live Audio Sessions with 1-tap Join
 * 2. Activity & Notifications History with timestamps and unread state
 */
export default function ChatterNotificationsModal({
  isOpen,
  onClose,
  activeSpaces = [],
  notifications = [],
  onJoinSpace,
  onMarkAllRead,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'live' | 'alerts'
  const [isMarking, setIsMarking] = useState(false);

  if (!isOpen) return null;

  const handleMarkRead = async () => {
    setIsMarking(true);
    try {
      await onMarkAllRead?.();
    } finally {
      setIsMarking(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const unreadAlerts = notifications.filter((n) => !n.read);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '85dvh',
          background: 'var(--chatter-sheet, #121212)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(64, 227, 120, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#fff',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: 'rgba(64, 227, 120, 0.14)',
                color: 'var(--chatter-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff' }}>
                Notifications & Activity
              </h2>
              <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
                {activeSpaces.length > 0
                  ? `🔴 ${activeSpaces.length} live space${activeSpaces.length > 1 ? 's' : ''} ongoing now`
                  : 'Stay up to date with your study spaces'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadAlerts.length > 0 && (
              <button
                type="button"
                onClick={handleMarkRead}
                disabled={isMarking}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--chatter-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                {isMarking ? 'Marking...' : 'Mark all read'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div
          style={{
            display: 'flex',
            padding: '10px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            gap: 8,
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'all' ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.06)',
              color: activeTab === 'all' ? '#0E0E0E' : 'var(--chatter-light-text)',
              transition: 'all 0.15s ease',
            }}
          >
            All Updates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'live' ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.06)',
              color: activeTab === 'live' ? '#0E0E0E' : 'var(--chatter-light-text)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            <span>Live Spaces ({activeSpaces.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'alerts' ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.06)',
              color: activeTab === 'alerts' ? '#0E0E0E' : 'var(--chatter-light-text)',
              transition: 'all 0.15s ease',
            }}
          >
            Alerts {unreadAlerts.length > 0 && `(${unreadAlerts.length})`}
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Ongoing Live Spaces */}
          {(activeTab === 'all' || activeTab === 'live') && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  🔴 Live Audio Spaces Right Now
                </div>
                {activeSpaces.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                    Tap to join instantly
                  </span>
                )}
              </div>

              {activeSpaces.length === 0 ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    color: 'var(--chatter-light-text)',
                    fontSize: 13.5,
                  }}
                >
                  <span>No live audio spaces active right now.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeSpaces.map((space) => (
                    <div
                      key={space.channelId}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 18,
                        background: 'linear-gradient(135deg, rgba(64, 227, 120, 0.08), rgba(20, 20, 20, 0.95))',
                        border: '1.5px solid rgba(64, 227, 120, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#22c55e',
                              boxShadow: '0 0 8px #22c55e',
                              animation: 'studycordPulse 1.8s infinite',
                            }}
                          />
                          <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#fff' }}>
                            {space.channelName || space.serverName || 'Live Study Space'}
                          </h4>
                          <span
                            style={{
                              fontSize: 11,
                              background: 'rgba(64, 227, 120, 0.18)',
                              color: 'var(--chatter-primary)',
                              padding: '2px 8px',
                              borderRadius: 8,
                              fontWeight: 800,
                            }}
                          >
                            {space.category || 'Study'}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--chatter-light-text)' }}>
                          {space.serverName && space.serverName !== space.channelName ? `${space.serverName} · ` : ''}
                          <strong style={{ color: '#fff' }}>{space.activeCount} scholar{space.activeCount > 1 ? 's' : ''}</strong> in space
                          {space.speakers && space.speakers.length > 0 && (
                            <span> (e.g. {space.speakers.slice(0, 2).map((s) => s.name).join(', ')})</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onJoinSpace?.(space.serverId, space.channelId, space.channelName);
                        }}
                        style={{
                          background: 'var(--chatter-primary)',
                          border: 'none',
                          color: '#0E0E0E',
                          padding: '8px 16px',
                          borderRadius: 16,
                          fontSize: 13.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                          boxShadow: '0 4px 14px rgba(64, 227, 120, 0.35)',
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                        </svg>
                        <span>Join Live</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Notifications History */}
          {(activeTab === 'all' || activeTab === 'alerts') && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Recent Alerts & Notifications
              </div>

              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.02)',
                    textAlign: 'center',
                    color: 'var(--chatter-light-text)',
                    fontSize: 13.5,
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔔</div>
                  <span>You're all caught up! No recent alerts.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.map((item) => {
                    const isSpaceNotif = item.type === 'space-started';
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 16,
                          background: item.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(64, 227, 120, 0.06)',
                          border: item.read ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(64, 227, 120, 0.25)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: isSpaceNotif ? 'rgba(64, 227, 120, 0.16)' : 'rgba(255, 255, 255, 0.08)',
                              color: isSpaceNotif ? 'var(--chatter-primary)' : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0,
                              overflow: 'hidden',
                            }}
                          >
                            {item.actor?.avatar_url ? (
                              <img src={item.actor.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : isSpaceNotif ? (
                              '🎙️'
                            ) : item.type === 'follow' ? (
                              '🌟'
                            ) : (
                              '💬'
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: item.read ? 600 : 800, color: '#fff', lineHeight: 1.4 }}>
                              {item.message || item.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--chatter-light-text)', marginTop: 2 }}>
                              {formatTimeAgo(item.createdAt)}
                            </div>
                          </div>
                        </div>

                        {isSpaceNotif && item.data?.channelId && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onJoinSpace?.(
                                item.data.serverId,
                                item.data.channelId,
                                item.data.serverName || 'Live Space'
                              );
                            }}
                            style={{
                              background: 'rgba(64, 227, 120, 0.16)',
                              border: '1px solid var(--chatter-primary)',
                              color: 'var(--chatter-primary)',
                              padding: '6px 12px',
                              borderRadius: 12,
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            Join Space
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
