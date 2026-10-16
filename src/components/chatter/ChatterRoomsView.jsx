import { useState, useEffect, useMemo, useCallback } from 'react';
import { getPusherClient } from '../../lib/pusherClient';

export default function ChatterRoomsView({
  servers = [],
  activeServerId,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onJoinVoiceChannel,
  onRefreshServers,
  onOpenSettings,
  isJoinedInVoiceRoom = false,
  activeVoiceChannelName = null,
}) {
  const [selectedInterest, setSelectedInterest] = useState('All');
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all' | 'joined'
  const [communityRooms, setCommunityRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joiningServerId, setJoiningServerId] = useState(null);
  const [creatingSpace, setCreatingSpace] = useState(false);

  // Dynamically compute all interests including custom categories created by users
  // Dynamically compute user-created topics if any exist, without hardcoded presets
  const interests = useMemo(() => {
    const custom = new Set();
    [...communityRooms, ...servers].forEach((s) => {
      const cat = s?.category?.trim();
      if (cat && cat !== 'All') {
        custom.add(cat);
      }
    });
    const customList = Array.from(custom);
    return customList.length > 0 ? ['All', ...customList] : [];
  }, [communityRooms, servers]);

  // Only return the subject/topic if explicitly set by the room creator
  const getServerCategory = (server) => {
    return server?.category ? String(server.category).trim() : '';
  };

  const [copiedServerId, setCopiedServerId] = useState(null);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [createSpaceModalOpen, setCreateSpaceModalOpen] = useState(false);
  const [userFollowers, setUserFollowers] = useState(0);
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceTopic, setNewSpaceTopic] = useState('');
  const [liveVoiceCounts, setLiveVoiceCounts] = useState({});
  const [liveSpeakersByChannel, setLiveSpeakersByChannel] = useState({});

  // 1. Fetch all community study rooms from MongoDB across all users
  const fetchAllCommunityRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/servers?all=true');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCommunityRooms(data);
        }
      }
    } catch (err) {
      console.warn('Failed to load community rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCommunityRooms();
  }, [fetchAllCommunityRooms]);

  // 2. Real-time Pusher Global Rooms Sync & Live Voice Counts
  useEffect(() => {
    let mounted = true;

    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/voice/active-counts');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            if (data?.counts) {
              setLiveVoiceCounts((prev) => ({ ...prev, ...data.counts }));
            }
            if (data?.speakers) {
              setLiveSpeakersByChannel((prev) => ({ ...prev, ...data.speakers }));
            }
          }
        }
      } catch {}
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);

    const pusher = getPusherClient();
    let voiceChannel = null;
    let roomsChannel = null;

    if (pusher) {
      try {
        // Voice counts channel
        voiceChannel = pusher.subscribe('voice-counts-global');
        voiceChannel.bind('voice-counts-updated', ({ channelId, count, speakers }) => {
          if (channelId && typeof count === 'number') {
            setLiveVoiceCounts((prev) => ({
              ...prev,
              [channelId]: count,
            }));
            if (Array.isArray(speakers)) {
              setLiveSpeakersByChannel((prev) => ({
                ...prev,
                [channelId]: speakers,
              }));
            }
          }
        });

        // Global study rooms channel for instant multi-device sync
        roomsChannel = pusher.subscribe('rooms-global');
        roomsChannel.bind('room-created', (newRoom) => {
          if (!newRoom?.id) return;
          setCommunityRooms((prev) => {
            if (prev.some((r) => r.id === newRoom.id)) return prev;
            return [newRoom, ...prev];
          });
        });

        roomsChannel.bind('room-joined', ({ serverId, memberCount }) => {
          if (!serverId) return;
          setCommunityRooms((prev) =>
            prev.map((r) => (r.id === serverId ? { ...r, member_count: memberCount || (r.member_count || 1) + 1 } : r))
          );
        });

        roomsChannel.bind('room-left', ({ serverId, memberCount }) => {
          if (!serverId) return;
          setCommunityRooms((prev) =>
            prev.map((r) => (r.id === serverId ? { ...r, member_count: Math.max(memberCount || 1, 1) } : r))
          );
        });

        roomsChannel.bind('room-deleted', ({ serverId }) => {
          if (!serverId) return;
          setCommunityRooms((prev) => prev.filter((r) => r.id !== serverId));
        });
      } catch (err) {
        console.warn('Pusher rooms sync error:', err);
      }
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (pusher) {
        try {
          if (voiceChannel) {
            voiceChannel.unbind_all();
            pusher.unsubscribe('voice-counts-global');
          }
          if (roomsChannel) {
            roomsChannel.unbind_all();
            pusher.unsubscribe('rooms-global');
          }
        } catch {}
      }
    };
  }, []);

  // 3. Load followers count to check hosting criteria
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

  // 4. Create real persistent audio study space saved in MongoDB & broadcasted to all devices
  const handleCreateSpaceSubmit = async (e) => {
    e.preventDefault();
    if (!newSpaceTitle.trim() || creatingSpace) return;

    const finalCategory = newSpaceTopic.trim() || null;

    setCreatingSpace(true);
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSpaceTitle.trim(),
          category: finalCategory,
          isAudioSpace: true,
        }),
      });

      if (res.ok) {
        const createdRoom = await res.json();
        setCommunityRooms((prev) => [createdRoom, ...prev.filter((r) => r.id !== createdRoom.id)]);
        onRefreshServers?.();
        setNewSpaceTitle('');
        setCustomCategory('');
        setIsCustomCategory(false);
        setCreateSpaceModalOpen(false);

        // Find voice channel and automatically join creator into the audio space
        const voiceCh = createdRoom.channels?.find((c) => c.type === 'voice') || createdRoom.channels?.[0];
        if (voiceCh) {
          onJoinVoiceChannel?.(createdRoom.id, voiceCh.id, createdRoom.name);
        }
      }
    } catch (err) {
      console.error('Failed to create audio space:', err);
    } finally {
      setCreatingSpace(false);
    }
  };

  // 5. Seamless 1-tap Join & Enter Study Room
  const handleJoinAndEnter = async (server, e) => {
    if (e) e.stopPropagation();

    const isAlreadyMember = server.is_member || server.role === 'owner' || server.role === 'member' || servers.some((s) => s.id === server.id);
    if (isAlreadyMember) {
      const defaultCh = server.channels?.find((c) => c.type === 'text') || server.channels?.[0];
      onSelectServer?.(server.id, defaultCh?.id, defaultCh?.name);
      return;
    }

    setJoiningServerId(server.id);
    try {
      const res = await fetch('/api/servers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: server.invite_code || server.id }),
      });

      if (res.ok) {
        const joined = await res.json();
        const targetServer = joined.server || joined;
        setCommunityRooms((prev) =>
          prev.map((r) => (r.id === targetServer.id ? { ...r, is_member: true, role: 'member', member_count: (r.member_count || 1) + 1 } : r))
        );
        onRefreshServers?.();
        const defaultCh = targetServer.channels?.find((c) => c.type === 'text') || targetServer.channels?.[0];
        onSelectServer?.(targetServer.id, defaultCh?.id, defaultCh?.name);
      }
    } catch (err) {
      console.error('Error joining server:', err);
    } finally {
      setJoiningServerId(null);
    }
  };

  // 6. Merge community study rooms with user joined servers
  const combinedRooms = useMemo(() => {
    const map = new Map();

    // First add all community rooms
    communityRooms.forEach((r) => {
      map.set(r.id, { ...r });
    });

    // Then merge with user's servers prop to ensure membership flags & channels are up to date
    servers.forEach((s) => {
      const existing = map.get(s.id);
      if (existing) {
        map.set(s.id, {
          ...existing,
          ...s,
          is_member: true,
          role: s.role || existing.role || 'member',
          channels: s.channels?.length ? s.channels : existing.channels,
        });
      } else {
        map.set(s.id, {
          ...s,
          is_member: true,
          role: s.role || 'member',
        });
      }
    });

    return Array.from(map.values());
  }, [communityRooms, servers]);

  // Dynamic audio spaces from real server voice channels
  const serverVoiceSpaces = useMemo(() => {
    return combinedRooms.flatMap((srv) =>
      (srv.channels || [])
        .filter((ch) => ch.type === 'voice')
        .map((ch) => {
          const liveCount = liveVoiceCounts[ch.id] ?? 0;
          const liveSpeakers = liveSpeakersByChannel[ch.id] || [];
          return {
            id: ch.id,
            serverId: srv.id,
            serverName: srv.name,
            title: srv.is_audio_space ? srv.name : `${srv.name} – ${ch.name}`,
            category: srv.category ? String(srv.category).trim() : null,
            tags: srv.category ? [`#${String(srv.category).trim().replace(/\s+/g, '')}`, '#LiveStudy'] : ['#LiveStudy'],
            listenersCount: liveCount,
            isLiveNow: liveCount > 0,
            speakers: liveSpeakers,
          };
        })
    );
  }, [combinedRooms, liveVoiceCounts, liveSpeakersByChannel]);

  // Filter study rooms based on Tab ('all' vs 'joined') and academic category
  const filteredServers = useMemo(() => {
    return combinedRooms.filter((s) => {
      const isMember = s.is_member || s.role === 'owner' || s.role === 'member' || servers.some((userServer) => userServer.id === s.id);
      if (activeFilterTab === 'joined' && !isMember) return false;
      if (selectedInterest !== 'All' && getServerCategory(s) !== selectedInterest) return false;
      return true;
    });
  }, [combinedRooms, activeFilterTab, selectedInterest, servers]);

  const filteredSpaces = useMemo(() => {
    if (selectedInterest === 'All') return serverVoiceSpaces;
    return serverVoiceSpaces.filter((s) => s.category === selectedInterest || s.category === 'All');
  }, [serverVoiceSpaces, selectedInterest]);

  const myJoinedCount = useMemo(() => {
    return combinedRooms.filter((s) => s.is_member || s.role === 'owner' || s.role === 'member' || servers.some((us) => us.id === s.id)).length;
  }, [combinedRooms, servers]);

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', width: '100%' }}>
      {/* ── 1. Study Rooms Section ── */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
              Study Rooms
            </h2>
            <span style={{ fontSize: 13.5, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '3px 10px', borderRadius: 12, fontWeight: 700 }}>
              {combinedRooms.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={onJoinServer}
              style={{
                padding: '8px 16px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>Join via Code</span>
            </button>
            <button
              type="button"
              onClick={onCreateServer}
              style={{
                padding: '8px 18px',
                borderRadius: 14,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 14.5,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 12px rgba(64, 227, 120, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              <span>Create Room</span>
            </button>
          </div>
        </div>

        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: '0 0 14px 0' }}>
          Discover collaborative study rooms across all devices. Join any session or host your own group.
        </p>

        {/* Tab Switcher: All Rooms vs My Rooms */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setActiveFilterTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 12,
              background: activeFilterTab === 'all' ? 'rgba(64, 227, 120, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              border: activeFilterTab === 'all' ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: activeFilterTab === 'all' ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Study Rooms ({combinedRooms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('joined')}
            style={{
              padding: '6px 14px',
              borderRadius: 12,
              background: activeFilterTab === 'joined' ? 'rgba(64, 227, 120, 0.18)' : 'rgba(255, 255, 255, 0.06)',
              border: activeFilterTab === 'joined' ? '1px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: activeFilterTab === 'joined' ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            My Rooms ({myJoinedCount})
          </button>
        </div>

        {/* Academic Subject Pills (only rendered if user-created topics exist) */}
        {interests.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 14, scrollbarWidth: 'none' }}>
            {interests.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedInterest(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: selectedInterest === cat ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                  border: selectedInterest === cat ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                  color: selectedInterest === cat ? '#fff' : 'var(--chatter-light-text)',
                  fontSize: 13,
                  fontWeight: selectedInterest === cat ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                #{cat}
              </button>
            ))}
          </div>
        )}

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
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
              {activeFilterTab === 'joined' ? 'You haven’t joined any rooms yet' : `No study rooms under #${selectedInterest}`}
            </div>
            <p style={{ fontSize: 14, color: 'var(--chatter-light-text)', margin: '6px 0 16px 0' }}>
              {activeFilterTab === 'joined'
                ? 'Browse all study rooms below to find peers and study groups.'
                : 'Be the first to create a study group for this topic!'}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveFilterTab('all');
                setSelectedInterest('All');
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 14,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--chatter-primary)',
                fontSize: 14.5,
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
              const isCopied = copiedServerId === server.id;
              const isMember = server.is_member || server.role === 'owner' || server.role === 'member' || servers.some((us) => us.id === server.id);
              const isOwner = server.role === 'owner';
              const isJoiningThis = joiningServerId === server.id;

              return (
                <div
                  key={server.id}
                  onClick={() => handleJoinAndEnter(server)}
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
                  {/* Line 1: Room icon, title, active status badge */}
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
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                          {server.is_audio_space && (
                            <span style={{ fontSize: 11, background: 'rgba(64, 227, 120, 0.18)', color: 'var(--chatter-primary)', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>
                              LIVE SPACE
                            </span>
                          )}
                        </div>
                        {getServerCategory(server) ? (
                          <div style={{ fontSize: 13, color: 'var(--chatter-hashtag)', fontWeight: 600, marginTop: 2 }}>
                            #{getServerCategory(server)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {isCurrent ? (
                        <span style={{ fontSize: 12.5, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                          Active Room
                        </span>
                      ) : isOwner ? (
                        <span style={{ fontSize: 12.5, background: 'rgba(64, 227, 120, 0.12)', color: 'var(--chatter-primary)', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                          Host
                        </span>
                      ) : isMember ? (
                        <span style={{ fontSize: 12.5, background: 'rgba(255, 255, 255, 0.08)', color: '#d1d1d1', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                          Joined
                        </span>
                      ) : (
                        <span style={{ fontSize: 12.5, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--chatter-light-text)', padding: '4px 10px', borderRadius: 12, fontWeight: 600 }}>
                          Open
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Line 2: Followed by members number below */}
                  <div style={{ fontSize: 14.5, color: 'var(--chatter-light-text)', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{server.member_count || 1} members</span>
                    <span>·</span>
                    <span style={{ color: isMember ? 'var(--chatter-primary)' : 'var(--chatter-light-text)', fontWeight: 500 }}>
                      {isOwner ? 'Created by you' : isMember ? 'You are a member' : 'Available across all devices'}
                    </span>
                  </div>

                  {/* Line 3: Actions row */}
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
                        fontSize: 14,
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
                          <span>Code</span>
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
                        fontSize: 14,
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
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          <span>Link</span>
                        </>
                      )}
                    </button>

                    {/* Room Settings for Admin/Owner */}
                    {(isOwner || server.role === 'admin' || isCurrent) && onOpenSettings && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSettings(server);
                        }}
                        title="Room Settings (Admin)"
                        style={{
                          padding: '8px 14px',
                          borderRadius: 12,
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        <span>Settings</span>
                      </button>
                    )}

                    {/* Enter or Join Room button */}
                    <button
                      type="button"
                      disabled={isJoiningThis}
                      onClick={(e) => handleJoinAndEnter(server, e)}
                      style={{
                        marginLeft: 'auto',
                        padding: '9px 20px',
                        borderRadius: 20,
                        background: isMember ? 'var(--chatter-primary)' : 'rgba(64, 227, 120, 0.18)',
                        border: isMember ? 'none' : '1px solid var(--chatter-primary)',
                        color: isMember ? '#0E0E0E' : 'var(--chatter-primary)',
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: isJoiningThis ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {isJoiningThis ? (
                        <span>Joining...</span>
                      ) : isMember ? (
                        <span>Enter Room</span>
                      ) : (
                        <>
                          <span>+</span>
                          <span>Join Room</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 2. Live Audio Spaces (Drop-in Voice Study Discussions) ── */}
      <div style={{ padding: '8px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Live Audio Spaces</span>
              <span className="chatter-audiospace-live-badge">
                <span className="chatter-audiospace-live-dot" />
                LIVE
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={handleOpenStartSpace}
            style={{
              padding: '8px 18px',
              borderRadius: 14,
              background: 'rgba(64, 227, 120, 0.15)',
              border: '1px solid var(--chatter-primary)',
              color: 'var(--chatter-primary)',
              fontSize: 14.5,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span>🎙️</span>
            <span>+ Start Space</span>
          </button>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
          Real-time drop-in voice discussions synced across all devices and accounts.
        </p>

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
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              No active live audio spaces
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
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
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Start an Audio Space
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredSpaces.map((space) => (
              <div key={space.id} className="chatter-audiospace-card">
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

                {/* Overlapping Real-Time Speaker Avatars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                  <div className="chatter-speaker-stack" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {space.speakers && space.speakers.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {space.speakers.slice(0, 4).map((sp, idx) => (
                          <div
                            key={sp.userId || idx}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              marginLeft: idx === 0 ? 0 : -8,
                              border: '2px solid var(--chatter-black)',
                              background: '#222',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: 'var(--chatter-primary)',
                              zIndex: 4 - idx,
                            }}
                            title={sp.name}
                          >
                            {sp.avatar_url ? (
                              <img
                                src={sp.avatar_url}
                                alt={sp.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              sp.name?.[0]?.toUpperCase() || 'P'
                            )}
                          </div>
                        ))}
                        <span style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginLeft: 8, fontWeight: 500 }}>
                          {space.speakers.map((s) => s.name?.split(' ')[0] || s.name).slice(0, 2).join(', ')}
                          {space.speakers.length > 2 ? ` +${space.speakers.length - 2} more` : ''}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', fontWeight: 500 }}>
                        {space.isLiveNow
                          ? `${space.listenersCount} scholar${space.listenersCount > 1 ? 's' : ''} in discussion`
                          : 'Drop-in voice room'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onJoinVoiceChannel?.(
                        space.serverId,
                        space.id,
                        space.title
                      );
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 20,
                      background: 'var(--chatter-primary)',
                      border: 'none',
                      color: '#0E0E0E',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Join Space
                  </button>
                </div>
              </div>
            ))}
          </div>
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

      {/* ── Create Space Modal (Persisted in MongoDB & broadcasted across devices) ── */}
      {createSpaceModalOpen && (
        <div
          onClick={() => !creatingSpace && setCreateSpaceModalOpen(false)}
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
                disabled={creatingSpace}
                aria-label="Close"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSpaceSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#b5b5b5', marginBottom: 6 }}>
                  Space Topic / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic Chem Final Exam Review & Flashcards"
                  value={newSpaceTitle}
                  onChange={(e) => setNewSpaceTitle(e.target.value)}
                  required
                  autoFocus
                  disabled={creatingSpace}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#b5b5b5', marginBottom: 8 }}>
                  Topic / Subject <span style={{ opacity: 0.6, fontWeight: 500 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic Chemistry, Algorithms (Optional)"
                  value={newSpaceTopic}
                  onChange={(e) => setNewSpaceTopic(e.target.value)}
                  disabled={creatingSpace}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={creatingSpace}
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
                  disabled={!newSpaceTitle.trim() || creatingSpace}
                  style={{
                    flex: 1.4,
                    padding: '13px',
                    borderRadius: 14,
                    background: newSpaceTitle.trim() && !creatingSpace ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: newSpaceTitle.trim() && !creatingSpace ? '#0E0E0E' : '#777',
                    fontSize: 15.5,
                    fontWeight: 700,
                    cursor: newSpaceTitle.trim() && !creatingSpace ? 'pointer' : 'not-allowed',
                  }}
                >
                  {creatingSpace ? 'Launching...' : 'Go Live Now 🎙️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
