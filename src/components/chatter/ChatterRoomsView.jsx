'use client';

import { useState } from 'react';

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

  // Simulated live audio study spaces matching Chatter
  const [audioSpaces] = useState([
    {
      id: 'space-1',
      title: 'Late Night Algorithms & LeetCode Sprint 🚀',
      category: 'Computer Science',
      tags: ['#DynamicProgramming', '#Graphs', '#BigO'],
      listenersCount: 8,
      speakers: [
        { name: 'David', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80' },
        { name: 'Elena', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80' },
        { name: 'Kenji', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80' },
      ],
    },
    {
      id: 'space-2',
      title: 'MCAT Biology & Organic Chemistry Drill 🧬',
      category: 'Medicine',
      tags: ['#MCAT', '#Biochemistry', '#AminoAcids'],
      listenersCount: 14,
      speakers: [
        { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
        { name: 'Michael', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&auto=format&fit=crop&q=80' },
      ],
    },
    {
      id: 'space-3',
      title: 'Calculus III & Differential Equations Workshop 📐',
      category: 'Mathematics',
      tags: ['#Calculus', '#Integration', '#LinearAlgebra'],
      listenersCount: 19,
      speakers: [
        { name: 'Alex', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
        { name: 'Kenji', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80' },
      ],
    },
    {
      id: 'space-4',
      title: 'Silent Pomodoro Study Room (50/10) ⏳ Concentration',
      category: 'All',
      tags: ['#Pomodoro', '#DeepWork', '#Focus'],
      listenersCount: 22,
      speakers: [
        { name: 'Mia', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      ],
    },
  ]);

  const [copiedServerId, setCopiedServerId] = useState(null);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [userFollowers, setUserFollowers] = useState(0);
  const [customSpaces, setCustomSpaces] = useState([]);
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceCategory, setNewSpaceCategory] = useState('Computer Science');

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

  const allAudioSpaces = [...customSpaces, ...audioSpaces];

  const filteredSpaces = selectedInterest === 'All'
    ? allAudioSpaces
    : allAudioSpaces.filter((s) => s.category === selectedInterest || s.category === 'All');

  const filteredServers = selectedInterest === 'All'
    ? servers
    : servers.filter((s) => getServerCategory(s) === selectedInterest);

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', width: '100%' }}>
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
                padding: '7px 16px',
                borderRadius: 20,
                fontSize: 13,
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Study Rooms</span>
              <span style={{ fontSize: 12, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {filteredServers.length}
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onJoinServer}
              style={{
                padding: '6px 13px',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 12,
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
                padding: '6px 14px',
                borderRadius: 16,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Create Room
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: '0 0 14px 0' }}>
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
            <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>No study rooms under #{selectedInterest}</div>
            <button
              type="button"
              onClick={() => setSelectedInterest('All')}
              style={{
                marginTop: 10,
                padding: '5px 14px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--chatter-primary)',
                fontSize: 12,
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
                    border: isCurrent ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 16,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {server.icon_url ? (
                      <img
                        src={server.icon_url}
                        alt={server.name}
                        style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 14,
                          background: '#242424',
                          color: 'var(--chatter-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {server.name?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {server.name}
                      </h4>
                      <div style={{ fontSize: 12, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{channelsCount} study channels · {server.member_count || 1} members</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(e, server)}
                      title="Copy room code"
                      style={{
                        padding: '6px 9px',
                        borderRadius: 12,
                        background: isCopied ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: isCopied ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isCopied ? 'var(--chatter-primary)' : '#c0c0c0',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isCopied ? '✓ Copied' : '📋 Code'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(e, server)}
                      title="Copy direct invite link to this room"
                      style={{
                        padding: '6px 9px',
                        borderRadius: 12,
                        background: copiedLinkId === server.id ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        border: copiedLinkId === server.id ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: copiedLinkId === server.id ? 'var(--chatter-primary)' : '#c0c0c0',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedLinkId === server.id ? '✓ Link Copied' : '🔗 Link'}
                    </button>

                    {isCurrent ? (
                      <span style={{ fontSize: 11, background: 'rgba(64, 227, 120, 0.15)', color: 'var(--chatter-primary)', padding: '5px 10px', borderRadius: 12, fontWeight: 700 }}>
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const defaultCh = server.channels?.find((c) => c.type === 'text') || server.channels?.[0];
                          onSelectServer(server.id, defaultCh?.id, defaultCh?.name);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 14,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Enter
                      </button>
                    )}
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
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 3px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Live Audio Spaces</span>
              <span className="chatter-audiospace-live-badge">
                <span className="chatter-audiospace-live-dot" />
                LIVE
              </span>
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: 0 }}>
              Drop-in audio study spaces. Join as a listener or unmute to discuss topics with peers in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenStartSpace}
            style={{
              padding: '7px 14px',
              borderRadius: 16,
              background: 'rgba(64, 227, 120, 0.15)',
              border: '1px solid var(--chatter-primary)',
              color: 'var(--chatter-primary)',
              fontSize: 12,
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

        {filteredSpaces.map((space) => (
          <div key={space.id} className="chatter-audiospace-card" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                  {space.title}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {space.tags.map((t) => (
                    <span key={t} style={{ fontSize: 12, color: 'var(--chatter-hashtag)', fontWeight: 600 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--chatter-light-text)', whiteSpace: 'nowrap', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🎙️</span> {space.listenersCount} listening
              </div>
            </div>

            {/* Overlapping Speaker Avatars */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <div className="chatter-speaker-stack">
                {space.speakers.map((sp, i) => (
                  <img
                    key={i}
                    src={sp.avatar}
                    alt={sp.name}
                    className="chatter-speaker-avatar"
                    title={sp.name}
                  />
                ))}
                <span style={{ fontSize: 12, color: 'var(--chatter-light-text)', marginLeft: 10, fontWeight: 500 }}>
                  {space.speakers.map((s) => s.name).join(', ')} speaking
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const serverWithVoice = servers.find((s) => s.channels?.some((c) => c.type === 'voice'));
                  const voiceChan = serverWithVoice?.channels?.find((c) => c.type === 'voice');
                  onJoinVoiceChannel?.(
                    serverWithVoice?.id || space.id,
                    voiceChan?.id || space.id,
                    voiceChan?.name || space.title
                  );
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🎙️</span> Join Space
              </button>
            </div>
          </div>
        ))}
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
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
              Hosting Prerequisite
            </h3>
            <p style={{ fontSize: 13.5, color: '#b5b5b5', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              To ensure focused, high-quality study sessions and prevent spam, users need at least <strong style={{ color: '#fff' }}>5 followers</strong> on StudyCord to host public Live Audio Spaces.
            </p>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 14,
                padding: '12px 16px',
                marginBottom: 20,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
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

            <p style={{ fontSize: 12, color: 'var(--chatter-light-text)', margin: '0 0 20px 0', textAlign: 'left' }}>
              💡 Tip: Post revision notes in the StudyCord Feed or join study group channels to connect with peers and unlock space hosting!
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPrereqModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13.5,
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
                  padding: '11px 16px',
                  borderRadius: 14,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 13,
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🎙️ Start Audio Space</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateSpaceModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#979797',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSpaceSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#b5b5b5', marginBottom: 6 }}>
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
                    padding: '11px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#b5b5b5', marginBottom: 6 }}>
                  Subject Category
                </label>
                <select
                  value={newSpaceCategory}
                  onChange={(e) => setNewSpaceCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 14,
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
                    padding: '12px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
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
                    padding: '12px',
                    borderRadius: 14,
                    background: newSpaceTitle.trim() ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: newSpaceTitle.trim() ? '#0E0E0E' : '#777',
                    fontSize: 14,
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
