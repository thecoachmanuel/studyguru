'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';
import { getPusherClient } from '@/lib/pusherClient';

export default function ChatterChatsView({
  servers = [],
  activeServerId,
  activeChannelId,
  onSelectChannel,
  onOpenDMsModal,
  unreadCounts = {},
  user,
}) {
  const [activeSegment, setActiveSegment] = useState(0); // 0: Direct Chats, 1: Study Rooms, 2: Requests
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch real conversations from API
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
        }
      }
    } catch (err) {
      console.warn('Failed to load real conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Real-time Pusher updates for incoming chats and requests
  useEffect(() => {
    if (!user?.id) return;
    let userChannel = null;
    try {
      const pusher = getPusherClient();
      if (pusher) {
        userChannel = pusher.subscribe(`user-${user.id}`);
        userChannel.bind('new-conversation', () => {
          fetchConversations();
        });
        userChannel.bind('new-message', () => {
          fetchConversations();
        });
      }
    } catch {}

    return () => {
      if (userChannel) {
        try {
          userChannel.unbind_all();
        } catch {}
      }
    };
  }, [user?.id, fetchConversations]);

  // Separate real conversations into Direct Chats and Study Requests
  const currentUserId = user?.id;

  const directChats = useMemo(() => {
    return conversations
      .filter((c) => {
        // Active if accepted, or if user was the sender of the request
        return c.status === 'accepted' || (c.requested_by && String(c.requested_by) === String(currentUserId));
      })
      .map((c) => {
        const lastMsgText = c.last_message?.content || (c.status === 'pending' ? 'Message request pending...' : 'No messages yet');
        let timeStr = 'Recently';
        if (c.updated_at) {
          const d = new Date(c.updated_at);
          timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        return {
          id: c.id,
          user: {
            id: c.other_user?.id || 'peer',
            name: c.other_user?.name || c.other_user?.username || 'Study Partner',
            username: c.other_user?.username || 'partner',
            avatar_url: c.other_user?.avatar_url || null,
            online: c.other_user?.status?.state === 'online',
          },
          lastMessage: lastMsgText,
          timestamp: timeStr,
          unread: unreadCounts[c.id] || 0,
        };
      });
  }, [conversations, currentUserId, unreadCounts]);

  const studyRequests = useMemo(() => {
    return conversations
      .filter((c) => {
        // Pending requests received from another user
        return c.status === 'pending' && String(c.requested_by) !== String(currentUserId);
      })
      .map((c) => {
        let timeStr = 'Recently';
        if (c.updated_at) {
          const diffMinutes = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 60000);
          if (diffMinutes < 60) timeStr = `${Math.max(1, diffMinutes)}m ago`;
          else if (diffMinutes < 1440) timeStr = `${Math.floor(diffMinutes / 60)}h ago`;
          else timeStr = new Date(c.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        return {
          id: c.id,
          user: {
            id: c.other_user?.id || 'peer',
            name: c.other_user?.name || c.other_user?.username || 'Study Partner',
            username: c.other_user?.username || 'partner',
            avatar_url: c.other_user?.avatar_url || null,
            online: c.other_user?.status?.state === 'online',
          },
          message: c.last_message?.content || 'Hi! Would you like to collaborate and study together?',
          timestamp: timeStr,
        };
      });
  }, [conversations, currentUserId]);

  // Aggregate channels from all joined servers
  const allChannels = useMemo(() => {
    return servers.flatMap((server) =>
      (server.channels || []).map((ch) => ({
        ...ch,
        serverName: server.name,
        serverId: server.id,
      }))
    );
  }, [servers]);

  const filteredChannels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allChannels;
    return allChannels.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.serverName || '').toLowerCase().includes(q)
    );
  }, [allChannels, searchQuery]);

  const filteredDMs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return directChats;
    return directChats.filter(
      (dm) =>
        dm.user.name.toLowerCase().includes(q) ||
        dm.lastMessage.toLowerCase().includes(q)
    );
  }, [directChats, searchQuery]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return studyRequests;
    return studyRequests.filter(
      (req) =>
        req.user.name.toLowerCase().includes(q) ||
        req.message.toLowerCase().includes(q)
    );
  }, [studyRequests, searchQuery]);

  // Accept a study request
  const handleAcceptRequest = async (req) => {
    setActionLoadingId(req.id);
    try {
      const res = await fetch(`/api/conversations/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === req.id ? { ...c, status: 'accepted' } : c))
        );
        // Switch to direct chats and select the new chat
        setActiveSegment(0);
        onSelectChannel?.(null, req.id, req.user.name, 'dm');
      }
    } catch (err) {
      console.warn('Accept request error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline a study request
  const handleDeclineRequest = async (reqId) => {
    setActionLoadingId(reqId);
    try {
      const res = await fetch(`/api/conversations/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== reqId));
      }
    } catch (err) {
      console.warn('Decline request error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* ── 1. Cupertino-style Sliding Segmented Control ── */}
      <div className="chatter-segment-control">
        <button
          type="button"
          className={`chatter-segment-btn ${activeSegment === 0 ? 'chatter-segment-btn--active' : ''}`}
          onClick={() => setActiveSegment(0)}
        >
          <span>Direct Chats</span>
          {directChats.some((d) => d.unread > 0) && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--chatter-red)' }} />
          )}
        </button>
        <button
          type="button"
          className={`chatter-segment-btn ${activeSegment === 1 ? 'chatter-segment-btn--active' : ''}`}
          onClick={() => setActiveSegment(1)}
        >
          <span>Study Rooms</span>
        </button>
        <button
          type="button"
          className={`chatter-segment-btn ${activeSegment === 2 ? 'chatter-segment-btn--active' : ''}`}
          onClick={() => setActiveSegment(2)}
        >
          <span>Requests</span>
          {studyRequests.length > 0 && (
            <span style={{ fontSize: 10, background: 'var(--chatter-primary)', color: '#0E0E0E', padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>
              {studyRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* ── 2. Search Input ── */}
      <div style={{ padding: '4px 16px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--chatter-sheet)',
            borderRadius: 14,
            padding: '10px 14px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#979797' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={
              activeSegment === 0 ? 'Search direct conversations...' : activeSegment === 1 ? 'Search study channels...' : 'Search study requests...'
            }
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

      {/* ── 3. Content according to Segment ── */}
      {/* 3a. Segment 0: Direct Chats */}
      {activeSegment === 0 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--chatter-light-text)', fontWeight: 600 }}>
              Recent Messages ({filteredDMs.length})
            </span>
            <button
              type="button"
              onClick={onOpenDMsModal}
              style={{
                background: 'rgba(64, 227, 120, 0.12)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontWeight: 700,
                fontSize: 12.5,
                padding: '5px 12px',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              + New DM
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
              Loading conversations...
            </div>
          ) : filteredDMs.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: 'var(--chatter-sheet)',
                borderRadius: 18,
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                No Direct Messages Yet
              </h4>
              <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
                Start a private study conversation with any classmate or study partner.
              </p>
              <button
                type="button"
                onClick={onOpenDMsModal}
                style={{
                  padding: '8px 18px',
                  borderRadius: 16,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Start a Direct Chat
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredDMs.map((dm) => (
                <div
                  key={dm.id}
                  onClick={() => onSelectChannel?.(null, dm.id, dm.user.name, 'dm')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: activeChannelId === dm.id ? 'rgba(64, 227, 120, 0.12)' : 'var(--chatter-sheet)',
                    border: activeChannelId === dm.id ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    {dm.user.avatar_url ? (
                      <img
                        src={dm.user.avatar_url}
                        alt={dm.user.name}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: '#242424',
                          color: 'var(--chatter-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        {dm.user.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    {dm.user.online ? (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 1,
                          right: 1,
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: 'var(--chatter-primary)',
                          border: '2px solid var(--chatter-sheet)',
                        }}
                        title="Online"
                      />
                    ) : (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 1,
                          right: 1,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.25)',
                          border: '2px solid var(--chatter-sheet)',
                        }}
                        title="Offline"
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
                          {dm.user.name}
                        </h4>
                        <TwitterVerifiedBadge />
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
                        {dm.timestamp}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                        {dm.lastMessage}
                      </p>
                      {dm.unread > 0 && (
                        <span
                          style={{
                            background: 'var(--chatter-red)',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 10,
                            padding: '2px 7px',
                          }}
                        >
                          {dm.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3b. Segment 1: Study Rooms (Channels) */}
      {activeSegment === 1 && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredChannels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)', background: 'var(--chatter-sheet)', borderRadius: 16 }}>
                No study channels found.
              </div>
            ) : (
              filteredChannels.map((channel) => {
                const isSelected = activeChannelId === channel.id;
                const unread = unreadCounts[channel.id] || 0;
                return (
                  <div
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.serverId, channel.id, channel.name, channel.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 16,
                      background: isSelected ? 'rgba(64, 227, 120, 0.12)' : 'var(--chatter-sheet)',
                      border: isSelected ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: '#242424',
                          color: channel.type === 'voice' ? 'var(--chatter-primary)' : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                        }}
                      >
                        {channel.type === 'voice' ? '🎙️' : '#'}
                      </div>

                      <div>
                        <h4 style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>
                          {channel.name}
                        </h4>
                        <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                          {channel.serverName} · {channel.type === 'voice' ? 'Voice Channel' : 'Text Discussion'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {unread > 0 && (
                        <span
                          style={{
                            background: 'var(--chatter-primary)',
                            color: '#0E0E0E',
                            fontSize: 11,
                            fontWeight: 700,
                            borderRadius: 10,
                            padding: '2px 7px',
                          }}
                        >
                          {unread}
                        </span>
                      )}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#979797' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3c. Segment 2: Study Requests */}
      {activeSegment === 2 && (
        <div style={{ padding: '0 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--chatter-light-text)' }}>
              Checking study requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: 'var(--chatter-sheet)',
                borderRadius: 18,
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                No Pending Study Requests
              </h4>
              <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: 0 }}>
                When classmates send you study partner invitations, they will appear here in real time.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 18,
                    padding: 16,
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative' }}>
                        {req.user.avatar_url ? (
                          <img
                            src={req.user.avatar_url}
                            alt={req.user.name}
                            style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              background: '#242424',
                              color: 'var(--chatter-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 16,
                            }}
                          >
                            {req.user.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        {req.user.online && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: 'var(--chatter-primary)',
                              border: '2px solid var(--chatter-sheet)',
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{req.user.name}</span>
                          <TwitterVerifiedBadge />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                          @{req.user.username} · {req.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                    &ldquo;{req.message}&rdquo;
                  </p>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      disabled={actionLoadingId === req.id}
                      onClick={() => handleAcceptRequest(req)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        borderRadius: 14,
                        background: 'var(--chatter-primary)',
                        border: 'none',
                        color: '#0E0E0E',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: actionLoadingId === req.id ? 'not-allowed' : 'pointer',
                        opacity: actionLoadingId === req.id ? 0.7 : 1,
                      }}
                    >
                      {actionLoadingId === req.id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === req.id}
                      onClick={() => handleDeclineRequest(req.id)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        borderRadius: 14,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: 'var(--chatter-light-text)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: actionLoadingId === req.id ? 'not-allowed' : 'pointer',
                        opacity: actionLoadingId === req.id ? 0.7 : 1,
                      }}
                    >
                      {actionLoadingId === req.id ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
