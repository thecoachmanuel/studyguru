'use client';

import { useState, useEffect, useMemo } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterNewDMSheet({
  isOpen,
  onClose,
  members = [],
  currentUserId,
  onSelectUser,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dbUsers, setDbUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch classmates/peers dynamically from DB
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/user/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (active) {
            setDbUsers(Array.isArray(data) ? data : []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setDbUsers([]);
            setLoading(false);
          }
        });
    }, searchQuery ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  // Combine DB users with server members, filtering out current user and duplicates
  const candidates = useMemo(() => {
    const list = [...dbUsers];
    members.forEach((m) => {
      const uId = m.user_id || m.id;
      if (uId && uId !== currentUserId && !list.some((p) => p.id === uId)) {
        list.push({
          id: uId,
          name: m.user?.name || m.name || 'Classmate',
          username: m.user?.username || m.username || 'student',
          avatar_url: m.user?.avatar_url || m.avatar_url,
          subject: 'Study Partner',
          online: false,
        });
      }
    });
    return list;
  }, [members, currentUserId, dbUsers]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxWidth: 580,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for bottom sheet */}
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.2)' }} />
        </div>

        {/* Sheet Header */}
        <div style={{ padding: '8px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 2px 0' }}>
              New Direct Message
            </h3>
            <p style={{ fontSize: 12, color: 'var(--chatter-light-text)', margin: 0 }}>
              Select a classmate or study partner to chat directly
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--chatter-black)',
              borderRadius: 14,
              padding: '10px 14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--chatter-light-text)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              autoFocus
              placeholder="Search classmates by name, username or major..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)', fontSize: 13 }}>
              Searching classmates...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)', fontSize: 13 }}>
              {searchQuery ? `No classmates found matching "${searchQuery}"` : 'No study partners found yet.'}
            </div>
          ) : (
            candidates.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  onClose();
                  onSelectUser?.(user);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--chatter-black)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--chatter-primary) 0%, #16a34a 100%)',
                          color: '#0E0E0E',
                          fontWeight: 800,
                          fontSize: 16,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(user.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {user.online ? (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 1,
                          right: 1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'var(--chatter-primary)',
                          border: '2px solid var(--chatter-sheet)',
                        }}
                        title="Online"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{user.name}</span>
                      <TwitterVerifiedBadge />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                      @{user.username} · {user.subject}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    padding: '7px 16px',
                    borderRadius: 14,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Message
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
