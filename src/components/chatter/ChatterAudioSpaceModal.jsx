'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatterAudioSpaceModal({
  voiceSession,
  channelName,
  serverName,
  roomOwnerId,
  onClose,
  userId,
  profile,
}) {
  const [raisedHand, setRaisedHand] = useState(false);
  const [raisedHandsMap, setRaisedHandsMap] = useState({});
  const [leaveNotification, setLeaveNotification] = useState('');
  const [joinNotification, setJoinNotification] = useState('');
  const [isScreenMaximized, setIsScreenMaximized] = useState(false);

  useEffect(() => {
    const handleUserLeft = (e) => {
      if (e?.detail?.name) {
        setLeaveNotification(`${e.detail.name} left the space`);
        const timer = setTimeout(() => setLeaveNotification(''), 4500);
        return () => clearTimeout(timer);
      }
    };
    const handleUserJoined = (e) => {
      if (e?.detail?.name) {
        setJoinNotification(`${e.detail.name} joined the space`);
        const timer = setTimeout(() => setJoinNotification(''), 4500);
        return () => clearTimeout(timer);
      }
    };
    const handleHandRaise = (e) => {
      if (e?.detail?.userId) {
        setRaisedHandsMap((prev) => ({
          ...prev,
          [String(e.detail.userId)]: Boolean(e.detail.raised),
        }));
      }
    };

    window.addEventListener('studycord_voice_user_left', handleUserLeft);
    window.addEventListener('studycord_voice_user_joined', handleUserJoined);
    window.addEventListener('studycord_hand_raise_updated', handleHandRaise);

    return () => {
      window.removeEventListener('studycord_voice_user_left', handleUserLeft);
      window.removeEventListener('studycord_voice_user_joined', handleUserJoined);
      window.removeEventListener('studycord_hand_raise_updated', handleHandRaise);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isScreenMaximized) {
        setIsScreenMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScreenMaximized]);

  const {
    participants = [],
    isMuted = false,
    error,
    setError,
    handleLeave,
    handleToggleMute,
    toggleMic = handleToggleMute,
    isScreenSharing,
    handleStartScreenShare,
    handleStopScreenShare,
    toggleScreenShare,
    screenShareBusy,
    screenShareError,
    setScreenShareError,
    autoplayWarning,
    localScreenStream,
    localVideoStream,
    remoteStreams = {},
    remoteScreenShareStates = {},
  } = voiceSession || {};

  const onToggleMic = () => {
    if (toggleMic) toggleMic();
    else if (handleToggleMute) handleToggleMute();
  };

  // Identify active remote screen sharer
  const remoteScreenSharerId = Object.keys(remoteScreenShareStates).find(
    (id) =>
      (Boolean(remoteScreenShareStates[id]?.enabled) || remoteScreenShareStates[id] === true) &&
      remoteStreams[id]
  );

  // Deduplicate participants rigorously by unique normalized string ID
  const participantsMap = new Map();
  const effectiveOwnerId = roomOwnerId ? String(roomOwnerId).trim() : null;

  for (const p of participants) {
    if (!p) continue;

    let normId = '';
    if (p.user_id) {
      normId = String(p.user_id).trim();
    } else if (p.userId) {
      normId = String(p.userId).trim();
    } else if (p.profiles?.id) {
      normId = String(p.profiles.id).trim();
    } else if (typeof p.id === 'string') {
      normId = p.id.startsWith('vp-') ? p.id.split('-').pop().trim() : p.id.trim();
    }

    if (!normId) continue;

    const isMe = normId === String(userId || '').trim();

    const rawName =
      p.name ||
      p.full_name ||
      p.profiles?.full_name ||
      p.profiles?.name ||
      p.user_name ||
      p.username ||
      p.profiles?.username;

    const displayName = isMe
      ? profile?.full_name || profile?.name || 'You'
      : rawName && rawName !== 'Scholar' && rawName !== 'User' && rawName !== 'Study Partner'
      ? rawName
      : p.profiles?.username || p.username || 'Study Partner';

    const avatarUrl = isMe
      ? profile?.avatar_url || profile?.image || null
      : p.profiles?.avatar_url || p.profiles?.image || p.avatar_url || p.image || null;

    const isHost = effectiveOwnerId ? normId === effectiveOwnerId : false;

    participantsMap.set(normId, {
      userId: normId,
      name: displayName,
      username: p.username || p.profiles?.username || '',
      avatar_url: avatarUrl,
      speaking: isMe ? !isMuted : !p.is_muted && p.speaking !== false,
      isMuted: isMe ? isMuted : (p.is_muted ?? false),
      isLocal: isMe,
      isHost,
    });
  }

  const isActuallyJoined = Boolean(voiceSession?.joinedChannelId);
  const myIdStr = String(userId || '').trim();
  if (isActuallyJoined && myIdStr && !participantsMap.has(myIdStr)) {
    const isMeHost = effectiveOwnerId ? myIdStr === effectiveOwnerId : false;
    participantsMap.set(myIdStr, {
      userId: myIdStr,
      name: profile?.full_name || profile?.name || 'You',
      avatar_url: profile?.avatar_url || profile?.image || null,
      speaking: !isMuted,
      isMuted,
      isLocal: true,
      isHost: isMeHost,
    });
  }

  const fullParticipants = Array.from(participantsMap.values());
  const speakers = fullParticipants.filter((p) => !p.isMuted);
  const listeners = fullParticipants.filter((p) => p.isMuted);

  const onToggleScreenShare = async () => {
    if (screenShareBusy) return;

    // Enforce single-sharer rule: only ONE user can share at a time
    if (!isScreenSharing && remoteScreenSharerId) {
      const sharerEntry = participantsMap.get(remoteScreenSharerId);
      const sharerName = sharerEntry?.name || 'Another participant';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('studycord_toast', {
            detail: `⚠️ ${sharerName} is already sharing screen. Only one person can share at a time.`,
          })
        );
      }
      return;
    }

    if (toggleScreenShare) {
      await toggleScreenShare();
    } else if (isScreenSharing) {
      await handleStopScreenShare?.();
    } else {
      await handleStartScreenShare?.();
    }
  };

  const activeScreenShare = isScreenSharing
    ? {
        isLocal: true,
        stream: localScreenStream || localVideoStream,
        userId: String(userId),
        name: profile?.full_name || profile?.name || 'You',
      }
    : remoteScreenSharerId
    ? {
        isLocal: false,
        stream: remoteStreams[remoteScreenSharerId],
        userId: remoteScreenSharerId,
        name: participantsMap.get(remoteScreenSharerId)?.name || 'Study Partner',
      }
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--chatter-black)',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* ── 1. Top Header matching Chatter AudioSpaceScreen ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding:
            'calc(14px + env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 14px max(20px, env(safe-area-inset-left, 0px))',
          background: 'var(--chatter-audiospace)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--chatter-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: 15.5,
            fontWeight: 700,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back</span>
        </button>

        <div style={{ textAlign: 'center', maxWidth: '60%', overflow: 'hidden' }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              margin: '0 0 3px 0',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {channelName || 'Live Study Space'}
          </h2>
          <div style={{ fontSize: 13.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
            {serverName || 'Study Room'} · 🔴 LIVE SPACE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Speakers count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#D4D4D4' }}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>{speakers.length}</span>
          </div>

          {/* Listeners count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#D4D4D4' }}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span>{listeners.length}</span>
          </div>
        </div>
      </header>

      {/* ── 2. Stage Area: Audio Stage & Screen Share ── */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          maxWidth: activeScreenShare ? '100%' : '1100px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Floating Error Banner */}
        {(screenShareError || error || autoplayWarning) && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              background: 'rgba(255, 57, 57, 0.15)',
              border: '1px solid rgba(255, 57, 57, 0.3)',
              color: '#FF6B6B',
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              gap: 10,
            }}
          >
            <span>{screenShareError || error || autoplayWarning}</span>
            <button
              type="button"
              onClick={() => {
                setScreenShareError?.('');
                setError?.('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 6px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Join Alert Banner (Glowing Emerald) */}
        {joinNotification && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              background: 'rgba(64, 227, 120, 0.16)',
              border: '1px solid rgba(64, 227, 120, 0.35)',
              color: 'var(--chatter-primary)',
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: 10,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 14 }}>🟢</span>
              <span>{joinNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setJoinNotification('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 6px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Floating Leave Alert Banner */}
        {leaveNotification && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: 13.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: 10,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>🔴 {leaveNotification}</span>
            <button
              type="button"
              onClick={() => setLeaveNotification('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                padding: '0 6px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── LIVE SCREEN SHARE (One user at a time) ── */}
        {activeScreenShare && (
          <div style={{ marginBottom: 28, width: '100%' }}>
            <ScreenSharePlayer
              stream={activeScreenShare.stream}
              isLocal={activeScreenShare.isLocal}
              isMaximized={isScreenMaximized}
              onToggleMaximize={() => setIsScreenMaximized((prev) => !prev)}
              onStopSharing={activeScreenShare.isLocal ? handleStopScreenShare : null}
            />
          </div>
        )}

        {/* ── Section: Speakers on Stage ── */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--chatter-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 16,
            }}
          >
            Speakers ({speakers.length})
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 20,
              justifyItems: 'center',
            }}
          >
            {speakers.map((speaker, index) => {
              const isMe = String(speaker.userId) === String(userId);
              const isSpeaking = speaker.speaking;
              const hasHandRaised = isMe ? raisedHand : Boolean(raisedHandsMap[speaker.userId]);
              return (
                <div
                  key={speaker.userId || index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  {/* Avatar with Chatter Pulsing Emerald Ring */}
                  <div
                    style={{
                      position: 'relative',
                      width: 82,
                      height: 82,
                      borderRadius: 28,
                      padding: 3,
                      background: isSpeaking ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
                      boxShadow: isSpeaking ? '0 0 16px rgba(64, 227, 120, 0.6)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {speaker.avatar_url ? (
                      <img
                        src={speaker.avatar_url}
                        alt={speaker.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 25,
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 25,
                          background: '#252525',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          fontWeight: 700,
                          color: 'var(--chatter-primary)',
                        }}
                      >
                        {speaker.name?.[0]?.toUpperCase() || 'P'}
                      </div>
                    )}

                    {/* Hand raised indicator badge */}
                    {hasHandRaised && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'var(--chatter-primary)',
                          color: '#0E0E0E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          border: '2px solid var(--chatter-black)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                          zIndex: 2,
                        }}
                        title={`${speaker.name} has hand raised`}
                      >
                        ✋
                      </div>
                    )}

                    {/* Mic indicator badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: isSpeaking ? 'var(--chatter-primary)' : '#222',
                        color: isSpeaking ? '#0E0E0E' : '#FF3939',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--chatter-black)',
                      }}
                    >
                      {isSpeaking ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        </svg>
                      ) : (
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      marginTop: 10,
                      fontSize: 15.5,
                      fontWeight: 600,
                      color: '#fff',
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {speaker.name} {isMe && '(You)'}
                  </span>

                  {/* 👑 Host Badge - Strictly for room creator/owner */}
                  {speaker.isHost && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: 'rgba(234, 179, 8, 0.18)',
                        color: '#FACC15',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        padding: '2px 7px',
                        borderRadius: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        marginTop: 4,
                      }}
                    >
                      👑 Host
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: 13,
                      marginTop: 2,
                      color: isSpeaking ? 'var(--chatter-primary)' : 'var(--chatter-light-text)',
                    }}
                  >
                    {isSpeaking ? 'Speaking' : 'Muted'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section: Listeners ── */}
        {listeners.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--chatter-light-text)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 16,
              }}
            >
              Listeners ({listeners.length})
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: 16,
                justifyItems: 'center',
              }}
            >
              {listeners.map((listener, index) => {
                const isMe = String(listener.userId) === String(userId);
                const hasHandRaised = isMe ? raisedHand : Boolean(raisedHandsMap[listener.userId]);
                return (
                  <div
                    key={listener.userId || index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: 60,
                        height: 60,
                        borderRadius: 20,
                        background: '#222',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#888',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 20,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {listener.avatar_url ? (
                          <img
                            src={listener.avatar_url}
                            alt={listener.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          listener.name?.[0]?.toUpperCase() || 'P'
                        )}
                      </div>
                      {hasHandRaised && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--chatter-primary)',
                            color: '#0E0E0E',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            border: '2px solid var(--chatter-black)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                            zIndex: 2,
                          }}
                          title={`${listener.name} has hand raised`}
                        >
                          ✋
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        color: 'var(--chatter-light-text)',
                        maxWidth: 80,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {listener.name} {isMe && '(You)'}
                    </span>

                    {/* 👑 Host Badge - Strictly for room creator/owner */}
                    {listener.isHost && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          background: 'rgba(234, 179, 8, 0.18)',
                          color: '#FACC15',
                          border: '1px solid rgba(234, 179, 8, 0.4)',
                          padding: '2px 6px',
                          borderRadius: 9,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          marginTop: 3,
                        }}
                      >
                        👑 Host
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── 3. Chatter Bottom Floating Control Bar (Voice & Screen Share) ── */}
      <footer
        style={{
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding:
            '16px max(20px, env(safe-area-inset-right, 0px)) max(14px, calc(14px + env(safe-area-inset-bottom, 0px))) max(20px, env(safe-area-inset-left, 0px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: activeScreenShare ? '100%' : '1000px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Raise Hand button */}
        <button
          type="button"
          onClick={async () => {
            const nextState = !raisedHand;
            setRaisedHand(nextState);
            setRaisedHandsMap((prev) => ({
              ...prev,
              [String(userId)]: nextState,
            }));
            const myName = profile?.full_name || profile?.name || 'You';
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('studycord_toast', {
                  detail: nextState
                    ? `✋ ${myName} raised hand to speak`
                    : `✋ ${myName} lowered hand`,
                })
              );
            }
            const chanId = voiceSession?.joinedChannelId;
            if (chanId) {
              try {
                await fetch(`/api/channels/${chanId}/voice`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'raise-hand', raised: nextState }),
                });
              } catch {}
            }
          }}
          style={{
            background: raisedHand ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: raisedHand ? '1.5px solid var(--chatter-primary)' : 'none',
            color: raisedHand ? 'var(--chatter-primary)' : '#fff',
            borderRadius: 24,
            padding: '10px 18px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✋</span>
          <span>{raisedHand ? 'Hand Raised' : 'Raise Hand'}</span>
        </button>

        {/* Center: Voice Mic & Screen Share Controls (Pure Voice + Screen Share) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={onToggleMic}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: !isMuted ? 'var(--chatter-primary)' : '#ef4444',
              color: !isMuted ? '#0E0E0E' : '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: !isMuted
                ? '0 4px 16px rgba(64, 227, 120, 0.35)'
                : '0 4px 16px rgba(239, 68, 68, 0.35)',
              transition: 'all 0.18s ease',
            }}
            title={!isMuted ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {!isMuted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path
                  d="M19 10v2a7 7 0 0 1-14 0v-2"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" />
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Screen Share Toggle Button */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            disabled={screenShareBusy}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: isScreenSharing ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: isScreenSharing ? '#0E0E0E' : '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: screenShareBusy ? 'not-allowed' : 'pointer',
              boxShadow: isScreenSharing ? '0 4px 16px rgba(64, 227, 120, 0.35)' : 'none',
              transition: 'all 0.18s ease',
            }}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
        </div>

        {/* Right: Leave Space Quietly (Red Pill matching Chatter) */}
        <button
          type="button"
          onClick={async () => {
            try {
              await handleLeave?.();
            } finally {
              onClose?.();
            }
          }}
          style={{
            background: 'rgba(255, 57, 57, 0.18)',
            border: '1px solid rgba(255, 57, 57, 0.3)',
            color: 'var(--chatter-red)',
            borderRadius: 24,
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Leave Quietly
        </button>
      </footer>
    </div>
  );
}

/**
 * ScreenSharePlayer
 * Minimal, zero-distraction screen player.
 * All text banners/writers removed; clean icon button for expand/fullscreen only.
 */
function ScreenSharePlayer({ stream, isLocal, isMaximized, onToggleMaximize, onStopSharing }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const attachAndPlay = () => {
      if (!videoElement) return;
      if (videoElement.srcObject !== (stream || null)) {
        videoElement.srcObject = stream || null;
      }
      if (stream && stream.getTracks().length > 0) {
        videoElement.play?.().catch(() => {});
      }
    };

    attachAndPlay();

    if (stream) {
      const handleTrackChange = () => {
        attachAndPlay();
      };
      stream.addEventListener('addtrack', handleTrackChange);
      stream.addEventListener('removetrack', handleTrackChange);
      return () => {
        stream.removeEventListener('addtrack', handleTrackChange);
        stream.removeEventListener('removetrack', handleTrackChange);
        videoElement.srcObject = null;
      };
    }
    return () => {
      videoElement.srcObject = null;
    };
  }, [stream]);

  return (
    <div
      style={{
        position: isMaximized ? 'fixed' : 'relative',
        inset: isMaximized ? 0 : undefined,
        zIndex: isMaximized ? 400 : 1,
        width: '100%',
        height: isMaximized ? '100dvh' : undefined,
        maxHeight: isMaximized ? '100dvh' : '65vh',
        aspectRatio: isMaximized ? undefined : '16 / 9',
        background: '#050505',
        borderRadius: isMaximized ? 0 : 20,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: isMaximized ? 'none' : '2px solid rgba(64, 227, 120, 0.4)',
        boxShadow: isMaximized ? 'none' : '0 12px 40px rgba(0,0,0,0.7)',
        margin: isMaximized ? 0 : '0 auto 20px',
      }}
    >
      {/* Sleek Minimal Floating Overlay (Icon-only, no distracting text) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        {isLocal && onStopSharing && (
          <button
            type="button"
            onClick={onStopSharing}
            title="Stop Sharing Screen"
            aria-label="Stop Sharing Screen"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.88)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleMaximize}
          title={isMaximized ? 'Exit Fullscreen' : 'Expand / Fullscreen'}
          aria-label={isMaximized ? 'Exit Fullscreen' : 'Expand / Fullscreen'}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: isMaximized ? 'var(--chatter-primary)' : 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: isMaximized ? '#0E0E0E' : '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          {isMaximized ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {/* Screen Video Frame */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#000',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
