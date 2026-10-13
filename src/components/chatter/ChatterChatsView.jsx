'use client';

import { useState } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

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

  // Sample DMs matching Chatter Direct Messages
  const [directChats, setDirectChats] = useState([
    {
      id: 'dm-1',
      user: {
        id: 'u-sarah',
        name: 'Sarah Chen',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
        online: true,
      },
      lastMessage: 'Can you send the PDF of chapter 4 practice problems?',
      timestamp: '14:20',
      unread: 2,
    },
    {
      id: 'dm-2',
      user: {
        id: 'u-alex',
        name: 'Alex Rivera',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
        online: false,
      },
      lastMessage: 'Good job on the quiz! That question 3 was tricky.',
      timestamp: 'Yesterday',
      unread: 0,
    },
    {
      id: 'dm-3',
      user: {
        id: 'u-david',
        name: 'David Kim',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        online: true,
      },
      lastMessage: 'Are we still meeting in the audio room at 8pm?',
      timestamp: 'Oct 12',
      unread: 0,
    },
  ]);

  // Pending Study Partner Requests matching Chatter requests tab
  const [studyRequests, setStudyRequests] = useState([
    {
      id: 'req-1',
      user: {
        id: 'u-kenji',
        name: 'Kenji Sato',
        username: 'kenji_s',
        avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
        online: true,
      },
      message: 'Hey, saw your notes on Dynamic Programming. Would you like to study together for midterms?',
      timestamp: '2h ago',
    },
    {
      id: 'req-2',
      user: {
        id: 'u-mia',
        name: 'Mia Thorne',
        username: 'mia_t',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        online: false,
      },
      message: 'Hi! Can you share the solution set for Calculus Problem Set 3?',
      timestamp: 'Yesterday',
    },
  ]);

  // Aggregate channels from all joined servers
  const allChannels = servers.flatMap((server) =>
    (server.channels || []).map((ch) => ({
      ...ch,
      serverName: server.name,
      serverId: server.id,
    }))
  );

  const filteredChannels = allChannels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.serverName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDMs = directChats.filter((dm) =>
    dm.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = studyRequests.filter((req) =>
    req.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAcceptRequest = (req) => {
    // Add to direct chats
    const newChat = {
      id: `dm-${Date.now()}`,
      user: req.user,
      lastMessage: req.message,
      timestamp: 'Just now',
      unread: 1,
    };
    setDirectChats([newChat, ...directChats]);
    setStudyRequests(studyRequests.filter((r) => r.id !== req.id));
  };

  const handleDeclineRequest = (reqId) => {
    setStudyRequests(studyRequests.filter((r) => r.id !== reqId));
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
              activeSegment === 0 ? 'Search study partners...' : activeSegment === 1 ? 'Search study channels...' : 'Search study requests...'
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
              Recent Messages
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
                  background: 'var(--chatter-sheet)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={dm.user.avatar_url}
                    alt={dm.user.name}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                  />
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
          {filteredRequests.length === 0 ? (
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
                When classmates send you study partner invitations, they will appear here.
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
                        <img
                          src={req.user.avatar_url}
                          alt={req.user.name}
                          style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                        />
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
                        cursor: 'pointer',
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
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
                        cursor: 'pointer',
                      }}
                    >
                      Decline
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
