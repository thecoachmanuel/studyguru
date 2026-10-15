'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatterAudioSpaceModal({
  voiceSession,
  channelName,
  serverName,
  onClose,
  userId,
  profile,
}) {
  const [raisedHand, setRaisedHand] = useState(false);
  const [raisedHandsMap, setRaisedHandsMap] = useState({});
  const [leaveNotification, setLeaveNotification] = useState('');
  const [activeTab, setActiveTab] = useState('stage'); // 'stage' | 'chat'

  useEffect(() => {
    const handleUserLeft = (e) => {
      if (e?.detail?.name) {
        setLeaveNotification(`${e.detail.name} left the space`);
        const timer = setTimeout(() => setLeaveNotification(''), 4500);
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
    window.addEventListener('studycord_hand_raise_updated', handleHandRaise);
    return () => {
      window.removeEventListener('studycord_voice_user_left', handleUserLeft);
      window.removeEventListener('studycord_hand_raise_updated', handleHandRaise);
    };
  }, []);

  const {
    participants = [],
    micConnected,
    isMuted = false,
    loading,
    joining,
    error,
    setError,
    handleLeave,
    handleToggleMute,
    toggleMic = handleToggleMute,
    cameraEnabled,
    handleTurnCameraOn,
    handleTurnCameraOff,
    toggleCamera,
    cameraBusy,
    cameraError,
    setCameraError,
    isScreenSharing,
    handleStartScreenShare,
    handleStopScreenShare,
    toggleScreenShare,
    screenShareBusy,
    screenShareError,
    setScreenShareError,
    autoplayWarning,
    localVideoStream,
    localScreenStream,
    remoteStreams = {},
    remoteScreenShareStates = {},
    remoteCameraStates = {},
  } = voiceSession || {};

  const onToggleMic = () => {
    if (toggleMic) toggleMic();
    else if (handleToggleMute) handleToggleMute();
  };

  const onToggleCamera = async () => {
    if (cameraBusy) return;
    if (toggleCamera) {
      await toggleCamera();
    } else if (cameraEnabled) {
      await handleTurnCameraOff?.();
    } else {
      await handleTurnCameraOn?.();
    }
  };

  const onToggleScreenShare = async () => {
    if (screenShareBusy) return;
    if (toggleScreenShare) {
      await toggleScreenShare();
    } else if (isScreenSharing) {
      await handleStopScreenShare?.();
    } else {
      await handleStartScreenShare?.();
    }
  };

  // Deduplicate participants rigorously by unique normalized string ID
  const participantsMap = new Map();

  for (const p of participants) {
    const rawId = p.user_id || p.userId || p.id;
    if (!rawId) continue;
    const normId = String(rawId).replace(/^vp-[^-]+-/, '');
    const isMe = normId === String(userId) || String(rawId) === String(userId);

    const rawName =
      p.name ||
      p.full_name ||
      p.profiles?.full_name ||
      p.profiles?.name ||
      p.profiles?.username ||
      p.user_name ||
      p.username;

    const displayName = isMe
      ? (profile?.full_name || profile?.name || 'You')
      : (rawName && rawName !== 'Scholar' && rawName !== 'User'
          ? rawName
          : (p.profiles?.username || p.username || 'Study Partner'));

    participantsMap.set(normId, {
      userId: normId,
      name: displayName,
      username: p.username || p.profiles?.username || '',
      avatar_url: isMe
        ? (profile?.avatar_url || null)
        : (p.profiles?.avatar_url || p.avatar_url || null),
      speaking: isMe ? !isMuted : (!p.is_muted && p.speaking !== false),
      isMuted: isMe ? isMuted : (p.is_muted ?? false),
      isLocal: isMe,
    });
  }

  const isActuallyJoined = Boolean(voiceSession?.joinedChannelId);
  if (isActuallyJoined && !participantsMap.has(String(userId))) {
    participantsMap.set(String(userId), {
      userId: String(userId),
      name: profile?.full_name || profile?.name || 'You',
      avatar_url: profile?.avatar_url || null,
      speaking: !isMuted,
      isMuted,
      isLocal: true,
    });
  }

  const fullParticipants = Array.from(participantsMap.values());
  const speakers = fullParticipants.filter((p) => !p.isMuted);
  const listeners = fullParticipants.filter((p) => p.isMuted);

  // Fullscreen Theater Mode for Shared Screen
  const [isScreenMaximized, setIsScreenMaximized] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isScreenMaximized) {
        setIsScreenMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScreenMaximized]);

  // Identify active screen share (local or remote)
  const remoteScreenSharerId = Object.keys(remoteScreenShareStates).find(
    (id) => (Boolean(remoteScreenShareStates[id]?.enabled) || remoteScreenShareStates[id] === true) && remoteStreams[id]
  );
  const activeScreenShare = isScreenSharing
    ? {
        isLocal: true,
        stream: localScreenStream || localVideoStream,
        userId: String(userId),
        name: profile?.full_name || profile?.name || 'You',
        avatar_url: profile?.avatar_url,
      }
    : remoteScreenSharerId
      ? {
          isLocal: false,
          stream: remoteStreams[remoteScreenSharerId],
          userId: remoteScreenSharerId,
          name: participantsMap.get(remoteScreenSharerId)?.name || 'Study Partner',
          avatar_url: participantsMap.get(remoteScreenSharerId)?.avatar_url,
        }
      : null;

  const hasLocalCamera = Boolean(cameraEnabled && !isScreenSharing);
  const remoteVideoEntries = Object.entries(remoteStreams).filter(
    ([remoteId]) => remoteId !== remoteScreenSharerId
  );
  const hasAnyVideo = hasLocalCamera || remoteVideoEntries.length > 0;
  const totalVideos = (hasLocalCamera ? 1 : 0) + remoteVideoEntries.length;

  // Local camera video ref
  const localVideoRef = useRef(null);
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [localVideoStream]);

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
          padding: 'calc(14px + env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 14px max(20px, env(safe-area-inset-left, 0px))',
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back</span>
        </button>

        <div style={{ textAlign: 'center', maxWidth: '60%', overflow: 'hidden' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 3px 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {channelName || 'Live Study Space'}
          </h2>
          <div style={{ fontSize: 13.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
            {serverName || 'Study Room'} · 🔴 LIVE SPACE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Speakers count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#D4D4D4' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>{speakers.length}</span>
          </div>

          {/* Listeners count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#D4D4D4' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span>{listeners.length}</span>
          </div>
        </div>
      </header>

      {/* ── 2. Stage Area: Speakers & Video Tiles ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', maxWidth: activeScreenShare ? '100%' : '1100px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Floating Error / Notification Banner */}
        {(screenShareError || cameraError || error || autoplayWarning) && (
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
            <span>{screenShareError || cameraError || error || autoplayWarning}</span>
            <button
              type="button"
              onClick={() => {
                setScreenShareError?.('');
                setCameraError?.('');
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

        {/* ── LIVE SCREEN SHARE & VIDEO STAGE ── */}
        {(activeScreenShare || hasAnyVideo) && (
          <div style={{ marginBottom: 28, width: '100%' }}>
            {/* 1. When a screen is being shared, show it boldly across 100% width at top */}
            {activeScreenShare && (
              <ScreenSharePlayer
                stream={activeScreenShare.stream}
                isLocal={activeScreenShare.isLocal}
                sharerName={activeScreenShare.name}
                isMaximized={isScreenMaximized}
                onToggleMaximize={() => setIsScreenMaximized((prev) => !prev)}
                onStopSharing={activeScreenShare.isLocal ? handleStopScreenShare : null}
              />
            )}

            {/* 2. When screen is sharing, render active camera feeds in a neat participant strip below the screen */}
            {activeScreenShare ? (
              hasAnyVideo && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Active Cameras ({hasLocalCamera ? 1 : 0 + remoteVideoEntries.length})
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      overflowX: 'auto',
                      padding: '4px 2px 10px',
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {/* Local Camera Tile in strip */}
                    {hasLocalCamera && (
                      <div
                        className="chatter-video-tile"
                        style={{
                          position: 'relative',
                          borderRadius: 16,
                          overflow: 'hidden',
                          background: '#111',
                          border: !isMuted ? '2px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: !isMuted ? '0 0 14px rgba(64, 227, 120, 0.35)' : 'none',
                          aspectRatio: '16/9',
                          width: 200,
                          minWidth: 180,
                          height: 120,
                          flexShrink: 0,
                        }}
                      >
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center center',
                            display: 'block',
                            transform: 'scaleX(-1)',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 8,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            padding: '3px 8px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            zIndex: 2,
                          }}
                        >
                          <span>{profile?.name || 'You'} (You)</span>
                        </div>
                      </div>
                    )}

                    {/* Remote Camera Tiles in strip */}
                    {remoteVideoEntries.map(([remoteId, stream]) => {
                      const p = participantsMap.get(remoteId) || participants.find((part) => String(part.userId || part.user_id) === String(remoteId));
                      const isSpeaking = p?.speaking;
                      return (
                        <div
                          key={remoteId}
                          style={{
                            width: 200,
                            minWidth: 180,
                            height: 120,
                            flexShrink: 0,
                          }}
                        >
                          <RemoteVideoTile
                            remoteUserId={remoteId}
                            stream={stream}
                            participant={p}
                            isSpeaking={isSpeaking}
                            totalVideos={remoteVideoEntries.length + (hasLocalCamera ? 1 : 0)}
                            isHandRaised={Boolean(raisedHandsMap[remoteId])}
                            compact={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : (
              /* 3. When NO screen is sharing, show cameras in modern responsive grid */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Live Video Stage ({totalVideos})
                  </div>
                  {raisedHand && (
                    <span style={{ fontSize: 12.5, background: 'rgba(64, 227, 120, 0.16)', color: 'var(--chatter-primary)', padding: '3px 9px', borderRadius: 12, fontWeight: 700 }}>
                      ✋ Hand Raised
                    </span>
                  )}
                </div>
                <div
                  className={`chatter-video-stage-grid ${totalVideos === 1 ? 'single-video' : 'multi-video'}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      totalVideos === 1
                        ? '1fr'
                        : totalVideos === 2
                          ? 'repeat(auto-fit, minmax(280px, 1fr))'
                          : 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 14,
                    width: '100%',
                  }}
                >
                  {/* Local Camera Tile */}
                  {hasLocalCamera && (
                    <div
                      className="chatter-video-tile"
                      style={{
                        position: 'relative',
                        borderRadius: 20,
                        overflow: 'hidden',
                        background: '#111',
                        border: !isMuted ? '2px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: !isMuted ? '0 0 16px rgba(64, 227, 120, 0.4)' : 'none',
                        aspectRatio: totalVideos === 1 ? '16/10' : '4/3',
                        maxWidth: totalVideos === 1 ? '620px' : '100%',
                        margin: '0 auto',
                        width: '100%',
                        minHeight: totalVideos === 1 ? 260 : 180,
                      }}
                    >
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center center',
                          display: 'block',
                          transform: 'scaleX(-1)',
                        }}
                      />
                      {raisedHand && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            background: 'rgba(64, 227, 120, 0.95)',
                            color: '#0E0E0E',
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 800,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            zIndex: 3,
                          }}
                        >
                          <span>✋</span> Hand Raised
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          left: 10,
                          background: 'rgba(0,0,0,0.65)',
                          backdropFilter: 'blur(4px)',
                          padding: '4px 10px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          zIndex: 2,
                        }}
                      >
                        <span>{profile?.name || 'You'} (You)</span>
                      </div>
                    </div>
                  )}

                  {/* Remote Video Tiles */}
                  {remoteVideoEntries.map(([remoteId, stream]) => {
                    const p = participantsMap.get(remoteId) || participants.find((part) => String(part.userId || part.user_id) === String(remoteId));
                    const isSpeaking = p?.speaking;
                    return (
                      <RemoteVideoTile
                        key={remoteId}
                        remoteUserId={remoteId}
                        stream={stream}
                        participant={p}
                        isSpeaking={isSpeaking}
                        totalVideos={totalVideos}
                        isHandRaised={Boolean(raisedHandsMap[remoteId])}
                        compact={false}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section: Speakers on Stage */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
                <div key={speaker.userId || index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
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
                        style={{ width: '100%', height: '100%', borderRadius: 25, objectFit: 'cover' }}
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
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <span style={{ marginTop: 10, fontSize: 15.5, fontWeight: 600, color: '#fff', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {speaker.name} {isMe && '(You)'}
                  </span>
                  <span style={{ fontSize: 13.5, color: isSpeaking ? 'var(--chatter-primary)' : 'var(--chatter-light-text)' }}>
                    {isSpeaking ? 'Speaking' : 'Muted'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Listeners */}
        {listeners.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
                  <div key={listener.userId || index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                      <div style={{ width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {listener.avatar_url ? (
                          <img src={listener.avatar_url} alt={listener.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    <span style={{ marginTop: 8, fontSize: 14, color: 'var(--chatter-light-text)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {listener.name} {isMe && '(You)'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── 3. Chatter Bottom Floating Control Bar (Safe Area Protected) ── */}
      <footer
        style={{
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px max(20px, env(safe-area-inset-right, 0px)) max(14px, calc(14px + env(safe-area-inset-bottom, 0px))) max(20px, env(safe-area-inset-left, 0px))',
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
              window.dispatchEvent(new CustomEvent('studycord_toast', {
                detail: nextState ? `✋ ${myName} raised hand to speak` : `✋ ${myName} lowered hand`,
              }));
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

        {/* Center: Media Toggles (Mic, Camera, Screen) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              boxShadow: !isMuted ? '0 4px 16px rgba(64, 227, 120, 0.35)' : '0 4px 16px rgba(239, 68, 68, 0.35)',
              transition: 'all 0.18s ease',
            }}
            title={!isMuted ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {!isMuted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" />
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Camera Toggle Button */}
          <button
            type="button"
            onClick={onToggleCamera}
            disabled={cameraBusy}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: cameraEnabled ? 'var(--chatter-primary)' : '#ef4444',
              color: cameraEnabled ? '#0E0E0E' : '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: cameraBusy ? 'not-allowed' : 'pointer',
              boxShadow: cameraEnabled ? '0 4px 16px rgba(64, 227, 120, 0.35)' : '0 4px 16px rgba(239, 68, 68, 0.35)',
              transition: 'all 0.18s ease',
            }}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {cameraEnabled ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" fill="currentColor" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 15.5l-5-3.5 5-3.5v7z" />
                <path d="M2 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" />
              </svg>
            )}
          </button>

          {/* Screen Share Toggle Button */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            disabled={screenShareBusy}
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: isScreenSharing ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: isScreenSharing ? '#0E0E0E' : '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: screenShareBusy ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s ease',
            }}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function ScreenSharePlayer({ stream, isLocal, sharerName, isMaximized, onToggleMaximize, onStopSharing }) {
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
        border: isMaximized ? 'none' : '2px solid rgba(64, 227, 120, 0.5)',
        boxShadow: isMaximized ? 'none' : '0 12px 40px rgba(0,0,0,0.7)',
        margin: isMaximized ? 0 : '0 auto 20px',
      }}
    >
      {/* Floating Header Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 18px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              background: 'var(--chatter-primary)',
              color: '#0E0E0E',
              fontSize: 12,
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0E0E0E' }} />
            LIVE SCREEN
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            🖥️ {sharerName}{isLocal ? ' (You)' : ''}&apos;s Screen
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLocal && onStopSharing && (
            <button
              type="button"
              onClick={onStopSharing}
              style={{
                background: 'rgba(239, 68, 68, 0.9)',
                border: 'none',
                color: '#fff',
                borderRadius: 12,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                transition: 'background 0.15s ease',
              }}
            >
              <span>⏹</span> Stop Sharing
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMaximize}
            title={isMaximized ? 'Exit Fullscreen (Esc)' : 'Maximize Screen'}
            style={{
              background: isMaximized ? 'var(--chatter-primary)' : 'rgba(0, 0, 0, 0.7)',
              border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.25)',
              color: isMaximized ? '#0E0E0E' : '#fff',
              borderRadius: 12,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{isMaximized ? '⤢' : '⛶'}</span>
            <span>{isMaximized ? 'Exit Fullscreen' : 'Maximize'}</span>
          </button>
        </div>
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

function RemoteVideoTile({ remoteUserId, stream, participant, isSpeaking, totalVideos = 1, isHandRaised = false, compact = false }) {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!stream) {
      setHasVideo(false);
      return;
    }

    const checkVideo = () => {
      const vTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
      const live = vTracks.some((t) => t.enabled && t.readyState === 'live');
      setHasVideo(live);
    };

    checkVideo();

    stream.addEventListener?.('addtrack', checkVideo);
    stream.addEventListener?.('removetrack', checkVideo);

    const interval = setInterval(checkVideo, 1000);

    return () => {
      stream.removeEventListener?.('addtrack', checkVideo);
      stream.removeEventListener?.('removetrack', checkVideo);
      clearInterval(interval);
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream && hasVideo) {
      videoRef.current.srcObject = stream;
      videoRef.current.play?.().catch(() => {});
    }
  }, [stream, hasVideo]);

  const participantName =
    participant?.name && participant.name !== 'Scholar' && participant.name !== 'User'
      ? participant.name
      : (participant?.username || 'Study Partner');

  return (
    <div
      className="chatter-video-tile"
      style={{
        position: 'relative',
        borderRadius: compact ? 16 : 20,
        overflow: 'hidden',
        background: '#141414',
        border: isSpeaking ? '2px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isSpeaking ? '0 0 16px rgba(64, 227, 120, 0.4)' : 'none',
        aspectRatio: compact ? '16/9' : (totalVideos === 1 ? '16/10' : '4/3'),
        maxWidth: compact ? '100%' : (totalVideos === 1 ? '540px' : '100%'),
        margin: '0 auto',
        width: '100%',
        minHeight: compact ? undefined : (totalVideos === 1 ? 260 : 180),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          display: hasVideo ? 'block' : 'none',
        }}
      />

      {!hasVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 6 : 10 }}>
          {participant?.avatar_url ? (
            <img
              src={participant.avatar_url}
              alt={participantName}
              style={{ width: compact ? 44 : 64, height: compact ? 44 : 64, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: compact ? 44 : 64,
                height: compact ? 44 : 64,
                borderRadius: '50%',
                background: '#252525',
                color: 'var(--chatter-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 18 : 24,
                fontWeight: 700,
              }}
            >
              {participantName?.[0]?.toUpperCase() || 'P'}
            </div>
          )}
          <span style={{ fontSize: compact ? 13 : 15.5, color: '#fff', fontWeight: 600 }}>{participantName}</span>
        </div>
      )}

      {/* Hand Raised indicator badge */}
      {isHandRaised && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(64, 227, 120, 0.95)',
            color: '#0E0E0E',
            padding: '3px 8px',
            borderRadius: 10,
            fontSize: 11.5,
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 3,
          }}
        >
          <span>✋</span> Hand Raised
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          padding: '3px 8px',
          borderRadius: 8,
          fontSize: compact ? 12 : 13.5,
          fontWeight: 600,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span>{participantName}</span>
        {isSpeaking && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--chatter-primary)',
              display: 'inline-block',
            }}
          />
        )}
      </div>
    </div>
  );
}
