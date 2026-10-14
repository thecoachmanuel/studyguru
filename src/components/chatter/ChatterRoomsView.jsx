import { useState, useEffect } from 'react';
import { getPusherClient } from '../../lib/pusherClient';

export default function ChatterRoomsView({
  servers = [],
  activeServerId,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onJoinVoiceChannel,
  isJoinedInVoiceRoom = false,
  activeVoiceChannelName = null,
}) {
  const [selectedInterest, setSelectedInterest] = useState('All');

  const interests = ['All', 'Computer Science', 'Mathematics', 'Biology', 'Medicine', 'Physics', 'Law'];

  // Categorize study servers dynamically
  const getServerCategory = (server) => {
    const name = (server.name || '').toLowerCase();
    if (name.includes('math') || name.includes('calc') || name.includes('algebra')) return 'Mathematics';
    if (name.includes('code') || name.includes('cs') || name.includes('comp') || name.includes('algo') || name.includes('prog')) return 'Computer Science';
    if (name.includes('bio') || name.includes('med')) return 'Medicine';
    if (name.includes('chem')) return 'Biology';
    if (name.includes('phys')) return 'Physics';
    if (name.includes('law')) return 'Law';
    return 'Computer Science';
  };

  // Dynamic live audio study spaces from user creations and server voice channels
  const [customSpaces, setCustomSpaces] = useState([]);

  const [copiedServerId, setCopiedServerId] = useState(null);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [userFollowers, setUserFollowers] = useState(0);
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceCategory, setNewSpaceCategory] = useState('Computer Science');
  const [liveVoiceCounts, setLiveVoiceCounts] = useState({});

  // Fetch active voice counts & subscribe to real-time participant changes
  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/voice/active-counts');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data?.counts) {
            setLiveVoiceCounts((prev) => ({ ...prev, ...data.counts }));
          }
        }
      } catch {}
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);

    const pusher = getPusherClient();
    let channel = null;
    if (pusher) {
      try {
        channel = pusher.subscribe('voice-counts-global');
        channel.bind('voice-counts-updated', ({ channelId, count }) => {
          if (channelId && typeof count === 'number') {
            setLiveVoiceCounts((prev) => ({
              ...prev,
              [channelId]: count,
            }));
          }
        });
      } catch (err) {
        console.warn('Pusher voice counts error:', err);
      }
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (pusher && channel) {
        try {
          channel.unbind_all();
          pusher.unsubscribe('voice-counts-global');
        } catch {}
      }
    };
  }, []);

  // Load followers count to check hosting criteria
  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.followers_count !== undefined) {
          setUserFollowers(data.user.followers_count);
        } else if (Array.isArray(data?.user?.followers)) {
          setUserFollowers(data.user.followers.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyCode = (e, server) => {
    e.stopPropagation();
    const code = server.invite_code || server.id;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedServerId(server.id);
    setTimeout(() => setCopiedServerId(null), 2200);
  };

  const handleCopyLink = (e, server) => {
    e.stopPropagation();
    const code = server.invite_code || server.id;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard?joinRoom=${encodeURIComponent(code)}`
      : `/dashboard?joinRoom=${encodeURIComponent(code)}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedLinkId(server.id);
    setTimeout(() => setCopiedLinkId(null), 2200);
  };

  const handleOpenStartSpace = () => {
    if (userFollowers < 5) {
      setPrereqModalOpen(true);
    } else {
      setCreateSpaceModalOpen(true);
    }
  };

  const handleCreateSpaceSubmit = (e) => {
    e.preventDefault();
    if (!newSpaceTitle.trim()) return;

    const newSpace = {
      id: `space-${Date.now()}`,
      title: newSpaceTitle.trim(),
      category: newSpaceCategory,
      tags: [`#${newSpaceCategory.replace(/\s+/g, '')}`, '#LiveStudy'],
      listenersCount: 1,
      speakers: [
        { name: 'You (Host)', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      ],
    };

    setCustomSpaces((prev) => [newSpace, ...prev]);
    setNewSpaceTitle('');
    setCreateSpaceModalOpen(false);

    // Automatically trigger voice channel join for this new space
    onJoinVoiceChannel?.(newSpace.id, newSpace.id, newSpace.title);
  };

  // Dynamic audio spaces from custom creations and real server voice channels
  const serverVoiceSpaces = servers.flatMap((srv) =>
    (srv.channels || [])
      .filter((ch) => ch.type === 'voice')
      .map((ch) => {
        const liveCount = liveVoiceCounts[ch.id] ?? 0;
        return {
          id: ch.id,
          serverId: srv.id,
          title: `${srv.name} – ${ch.name}`,
          category: getServerCategory(srv),
          tags: [`#${getServerCategory(srv).replace(/\s+/g, '')}`, '#StudyVoice'],
          listenersCount: liveCount,
          isLiveNow: liveCount > 0,
          speakers: [],
        };
      })
  );
  const allAudioSpaces = [...customSpaces, ...serverVoiceSpaces];

  const filteredSpaces = selectedInterest === 'All'
    ? allAudioSpaces
    : allAudioSpaces.filter((s) => s.category === selectedInterest || s.category === 'All');

  const filteredServers = selectedInterest === 'All'
    ? servers
    : servers.filter((s) => getServerCategory(s) === selectedInterest);

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))', width: '100%' }}>
      {/* ── 1. Top Subject & Interest Carousel ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '12px 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {interests.map((tag) => {
          const isSelected = selectedInterest === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedInterest(tag)}
              style={{
                padding: '8px 18px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                background: isSelected ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isSelected ? '#0E0E0E' : '#979797',
                transition: 'all 0.15s ease',
              }}
            >
              #{tag}
            </button>
          );
        })}
      </div>

      {/* ── 2. Study Rooms (Primary High-Priority Section) ── */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Study Rooms</span>
              <span style={{ fontSize: 13, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '3px 9px', borderRadius: 12, fontWeight: 700 }}>
                {filteredServers.length}
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onJoinServer}
              style={{
                padding: '7px 15px',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={onCreateServer}
              style={{
                padding: '7px 16px',
                borderRadius: 16,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Create Room
            </button>
          </div>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
          Collaborative course groups, textbook revision channels, and shared study materials.
        </p>

        {filteredServers.length === 0 ? (
          <div
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              background: 'var(--chatter-sheet)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>No study rooms under #{selectedInterest}</div>
            <button
              type="button"
              onClick={() => setSelectedInterest('All')}
              style={{
                marginTop: 12,
                padding: '7px 16px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--chatter-primary)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View All Study Rooms
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {filteredServers.map((server) => {
              const isCurrent = activeServerId === server.id;
              const channelsCount = server.channels?.length || 0;
              const isCopied = copiedServerId === server.id;
              const roomCode = server.invite_code || server.id;

              return (
                <div
                  key={server.id}
                  onClick={() => {
                    const defaultCh = server.channels?.find((c) => c.type === 'text') || server.channels?.[0];
                    onSelectServer(server.id, defaultCh?.id, defaultCh?.name);
                  }}
                  style={{
                    background: 'var(--chatter-sheet)',
                    border: isCurrent ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Line 1: Title of room name at top on a single line */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      {server.icon_url ? (
                        <img
                          src={server.icon_url}
                          alt={server.name}
                          style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: '#242424',
                            color: 'var(--chatter-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        >
                          {server.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                      )}
                      <h4 style={{
                        fontSize: 19,
                        fontWeight: 800,
                        color: '#fff',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em',
                      }}>
                        {server.name}
                      </h4>
                    </div>
                    {isCurrent && (
                      <span style={{ fontSize: 13, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '4px 10px', borderRadius: 12, fontWeight: 700, flexShrink: 0 }}>
                        Active Room
                      </span>
                    )}
                  </div>

                  {/* Line 2: Followed by members number below */}
                  <div style={{ fontSize: 15, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{server.member_count || 1} members</span>
                    <span>·</span>
                    <span style={{ color: 'var(--chatter-primary)', fontWeight: 500 }}>Active study room</span>
                  </div>

                  {/* Line 3: Next line with links for copy code, copy link, and to enter the room */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    {/* Copy Code */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(e, server)}
                      title="Copy room invite code"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 12,
                        background: isCopied ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: isCopied ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isCopied ? 'var(--chatter-primary)' : '#D4D4D4',
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isCopied ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>

                    {/* Copy Link */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(e, server)}
                      title="Copy direct invite link to this room"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 12,
                        background: copiedLinkId === server.id ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: copiedLinkId === server.id ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: copiedLinkId === server.id ? 'var(--chatter-primary)' : '#D4D4D4',
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedLinkId === server.id ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Enter Room button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const defaultCh = server.channels?.find((c) => c.type === 'text') || server.channels?.[0];
                        onSelectServer(server.id, defaultCh?.id, defaultCh?.name);
                      }}
                      style={{
                        marginLeft: 'auto',
                        padding: '8px 20px',
                        borderRadius: 14,
                        background: 'var(--chatter-primary)',
                        color: '#0E0E0E',
                        fontSize: 15,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 10px rgba(64, 227, 120, 0.25)',
                      }}
                    >
                      <span>Enter Room</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Live Audio Spaces (Drop-in Voice Study Discussions) ── */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Live Audio Spaces</span>
              <span className="chatter-audiospace-live-badge">
                <span className="chatter-audiospace-live-dot" />
                LIVE
              </span>
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: 0 }}>
              Drop-in audio study spaces. Join as a listener or unmute to discuss topics with peers in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenStartSpace}
            style={{
              padding: '8px 16px',
              borderRadius: 16,
              background: 'rgba(64, 227, 120, 0.15)',
              border: '1px solid var(--chatter-primary)',
              color: 'var(--chatter-primary)',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
            }}
          >
            <span>🎙️</span> + Start Space
          </button>
        </div>

        {filteredSpaces.length === 0 ? (
          <div
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              background: 'var(--chatter-sheet)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.05)',
              marginTop: 14,
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8 }}>🎙️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              No active live audio spaces
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
              Host a live audio space to discuss assignments, review flashcards, or study together with peers.
            </p>
            <button
              type="button"
              onClick={handleOpenStartSpace}
              style={{
                padding: '9px 20px',
                borderRadius: 16,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Start an Audio Space
            </button>
          </div>
        ) : (
          filteredSpaces.map((space) => (
            <div key={space.id} className="chatter-audiospace-card" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                    {space.title}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {space.tags?.map((t) => (
                      <span key={t} style={{ fontSize: 13.5, color: 'var(--chatter-hashtag)', fontWeight: 600 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 13.5, color: space.isLiveNow ? 'var(--chatter-primary)' : 'var(--chatter-light-text)', whiteSpace: 'nowrap', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {space.isLiveNow ? (
                    <>
                      <span className="chatter-audiospace-live-dot" style={{ display: 'inline-block' }} />
                      <span>{space.listenersCount} active</span>
                    </>
                  ) : (
                    <>
                      <span>🎙️</span>
                      <span>{space.listenersCount > 0 ? `${space.listenersCount} listening` : 'Open space'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Overlapping Speaker Avatars */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <div className="chatter-speaker-stack">
                  {(space.speakers || []).map((sp, i) => (
                    <img
                      key={i}
                      src={sp.avatar}
                      alt={sp.name}
                      className="chatter-speaker-avatar"
                      title={sp.name}
                    />
                  ))}
                  <span style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', marginLeft: 10, fontWeight: 500 }}>
                    {(space.speakers || []).length > 0
                      ? space.speakers.map((s) => s.name).join(', ') + ' speaking'
                      : space.isLiveNow
                        ? `${space.listenersCount} scholar${space.listenersCount > 1 ? 's' : ''} inside`
                        : 'Drop-in voice room'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const serverWithVoice = servers.find((s) => s.channels?.some((c) => c.type === 'voice'));
                    const voiceChan = serverWithVoice?.channels?.find((c) => c.type === 'voice');
                    onJoinVoiceChannel?.(
                      space.serverId || serverWithVoice?.id || space.id,
                      voiceChan?.id || space.id,
                      voiceChan?.name || space.title
                    );
                  }}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 20,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Join Space
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Prerequisite Modal (When followers < 5) ── */}
      {prereqModalOpen && (
        <div
          onClick={() => setPrereqModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--chatter-sheet)',
              borderRadius: 22,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              width: '100%',
              maxWidth: 420,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(64, 227, 120, 0.15)',
                color: 'var(--chatter-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                margin: '0 auto 16px',
              }}
            >
              🎙️
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
              Hosting Prerequisite
            </h3>
            <p style={{ fontSize: 15, color: '#b5b5b5', lineHeight: 1.55, margin: '0 0 18px 0' }}>
              To ensure focused, high-quality study sessions and prevent spam, users need at least <strong style={{ color: '#fff' }}>5 followers</strong> on StudyCord to host public Live Audio Spaces.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 20,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5, marginBottom: 8 }}>
                <span style={{ color: '#b5b5b5' }}>Your Followers Progress:</span>
                <span style={{ fontWeight: 800, color: 'var(--chatter-primary)' }}>{userFollowers} / 5</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (userFollowers / 5) * 100)}%`,
                    background: 'var(--chatter-primary)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', margin: '0 0 20px 0', textAlign: 'left', lineHeight: 1.5 }}>
              💡 Tip: Post revision notes in the StudyCord Feed or join study group channels to connect with peers and unlock space hosting!
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPrereqModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Got It
              </button>
              {/* Optional host bypass for testing / scholar demo */}
              <button
                type="button"
                onClick={() => {
                  setPrereqModalOpen(false);
                  setCreateSpaceModalOpen(true);
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: 14,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Host as Scholar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Space Modal (When criteria met or hosting) ── */}
      {createSpaceModalOpen && (
        <div
          onClick={() => setCreateSpaceModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--chatter-sheet)',
              borderRadius: 22,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              width: '100%',
              maxWidth: 440,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎙️ Start Audio Space</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateSpaceModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#979797',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSpaceSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#b5b5b5', marginBottom: 6 }}>
                  Space Topic / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic Chem Final Exam Review & Flashcards"
                  value={newSpaceTitle}
                  onChange={(e) => setNewSpaceTitle(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#b5b5b5', marginBottom: 6 }}>
                  Subject Category
                </label>
                <select
                  value={newSpaceCategory}
                  onChange={(e) => setNewSpaceCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Biology">Biology</option>
                  <option value="Physics">Physics</option>
                  <option value="Law">Law</option>
                  <option value="General Study">General Study</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateSpaceModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '13px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSpaceTitle.trim()}
                  style={{
                    flex: 1.4,
                    padding: '13px',
                    borderRadius: 14,
                    background: newSpaceTitle.trim() ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: newSpaceTitle.trim() ? '#0E0E0E' : '#777',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: newSpaceTitle.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Go Live Now 🎙️
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
