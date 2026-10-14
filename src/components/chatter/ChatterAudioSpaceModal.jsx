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
  const [activeTab, setActiveTab] = useState('stage'); // 'stage' | 'chat'

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

  // Standardize participants list across both schema formats
  const normalizedParticipants = participants.map((p) => {
    const isMe = String(p.user_id || p.userId) === String(userId);
    return {
      userId: p.user_id || p.userId,
      name: isMe
        ? (profile?.full_name || profile?.name || 'You')
        : (p.profiles?.full_name || p.profiles?.username || p.name || 'Scholar'),
      avatar_url: isMe
        ? (profile?.avatar_url || null)
        : (p.profiles?.avatar_url || p.avatar_url || null),
      speaking: isMe ? !isMuted : (!p.is_muted && p.speaking !== false),
      isMuted: isMe ? isMuted : (p.is_muted ?? false),
    };
  });

  const hasLocal = normalizedParticipants.some((p) => String(p.userId) === String(userId));
  const fullParticipants = hasLocal
    ? normalizedParticipants
    : [
        {
          userId,
          name: profile?.full_name || profile?.name || 'You',
          avatar_url: profile?.avatar_url || null,
          speaking: !isMuted,
          isMuted,
        },
        ...normalizedParticipants,
      ];

  const speakers = fullParticipants.filter((p) => !p.isMuted);
  const listeners = fullParticipants.filter((p) => p.isMuted);

  // Local video ref
  const localVideoRef = useRef(null);
  useEffect(() => {
    if (localVideoRef.current && (localVideoStream || localScreenStream)) {
      localVideoRef.current.srcObject = localScreenStream || localVideoStream;
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [localVideoStream, localScreenStream]);

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
          padding: '14px 20px',
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
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 3px 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {channelName || 'Live Study Space'}
          </h2>
          <div style={{ fontSize: 13.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
            {serverName || 'Study Room'} · 🔴 LIVE SPACE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Speakers count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14.5, color: '#D4D4D4' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>{speakers.length}</span>
          </div>

          {/* Listeners count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14.5, color: '#D4D4D4' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span>{listeners.length}</span>
          </div>
        </div>
      </header>

      {/* ── 2. Stage Area: Speakers & Video Tiles ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', maxWidth: 840, width: '100%', margin: '0 auto' }}>
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

        {/* Live Video Grid Area when Camera, Screen, or Remote Streams are active */}
        {(cameraEnabled || isScreenSharing || Object.keys(remoteStreams).length > 0) && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Live Video Stage
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {/* Local Video Tile */}
              {(cameraEnabled || isScreenSharing) && (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 20,
                    overflow: 'hidden',
                    background: '#111',
                    border: !isMuted ? '2px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: !isMuted ? '0 0 16px rgba(64, 227, 120, 0.4)' : 'none',
                    aspectRatio: isScreenSharing ? '16/9' : '1/1',
                    maxWidth: isScreenSharing ? '100%' : 360,
                    margin: '0 auto',
                    width: '100%',
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
                      objectFit: isScreenSharing ? 'contain' : 'cover',
                      objectPosition: 'center center',
                      display: 'block',
                      transform: isScreenSharing ? 'none' : 'scaleX(-1)',
                    }}
                  />
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
                    }}
                  >
                    <span>{profile?.name || 'You'} (You)</span>
                    {isScreenSharing && <span style={{ fontSize: 11, color: 'var(--chatter-primary)' }}>· Screen</span>}
                  </div>
                </div>
              )}

              {/* Remote Video Tiles */}
              {Object.entries(remoteStreams).map(([remoteId, stream]) => {
                const p = participants.find((part) => String(part.userId || part.user_id) === String(remoteId));
                const isSpeaking = p?.speaking;
                return (
                  <RemoteVideoTile
                    key={remoteId}
                    remoteUserId={remoteId}
                    stream={stream}
                    participant={p}
                    isSpeaking={isSpeaking}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Speakers on Stage */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
                        {speaker.name?.[0]?.toUpperCase() || 'S'}
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

                  <span style={{ marginTop: 10, fontSize: 14.5, fontWeight: 600, color: '#fff', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {speaker.name} {isMe && '(You)'}
                  </span>
                  <span style={{ fontSize: 13, color: isSpeaking ? 'var(--chatter-primary)' : 'var(--chatter-light-text)' }}>
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
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
              {listeners.map((listener, index) => (
                <div key={listener.userId || index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 20,
                      background: '#222',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#888',
                    }}
                  >
                    {listener.avatar_url ? (
                      <img src={listener.avatar_url} alt={listener.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      listener.name?.[0]?.toUpperCase() || 'L'
                    )}
                  </div>
                  <span style={{ marginTop: 8, fontSize: 13.5, color: 'var(--chatter-light-text)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {listener.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── 3. Chatter Bottom Floating Control Bar ── */}
      <footer
        style={{
          background: 'var(--chatter-sheet)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 840,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* Left: Raise Hand button */}
        <button
          type="button"
          onClick={() => setRaisedHand((r) => !r)}
          style={{
            background: raisedHand ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: raisedHand ? '1.5px solid var(--chatter-primary)' : 'none',
            color: raisedHand ? 'var(--chatter-primary)' : '#fff',
            borderRadius: 24,
            padding: '10px 18px',
            fontSize: 14.5,
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
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: !isMuted ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: !isMuted ? '#0E0E0E' : '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: !isMuted ? '0 4px 16px rgba(64, 227, 120, 0.35)' : 'none',
              transition: 'all 0.18s ease',
            }}
            title={!isMuted ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {!isMuted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
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
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: cameraEnabled ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: cameraEnabled ? '#0E0E0E' : '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: cameraBusy ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s ease',
            }}
            title={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
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
          onClick={() => {
            handleLeave?.();
            onClose?.();
          }}
          style={{
            background: 'rgba(255, 57, 57, 0.18)',
            border: '1px solid rgba(255, 57, 57, 0.3)',
            color: 'var(--chatter-red)',
            borderRadius: 24,
            padding: '10px 20px',
            fontSize: 14.5,
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

function RemoteVideoTile({ remoteUserId, stream, participant, isSpeaking }) {
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

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#141414',
        border: isSpeaking ? '2px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isSpeaking ? '0 0 16px rgba(64, 227, 120, 0.4)' : 'none',
        aspectRatio: '1/1',
        maxWidth: 360,
        margin: '0 auto',
        width: '100%',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {participant?.avatar_url ? (
            <img
              src={participant.avatar_url}
              alt={participant.name}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#252525',
                color: 'var(--chatter-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {participant?.name?.[0]?.toUpperCase() || 'P'}
            </div>
          )}
          <span style={{ fontSize: 14.5, color: '#fff', fontWeight: 600 }}>{participant?.name || 'Scholar'}</span>
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
        }}
      >
        <span>{participant?.name || 'Scholar'}</span>
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
