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
    loading,
    error,
    handleLeave,
    toggleMic,
    cameraEnabled,
    toggleCamera,
    cameraBusy,
    isScreenSharing,
    toggleScreenShare,
    screenShareBusy,
    localVideoStream,
    localScreenStream,
    remoteStreams = {},
  } = voiceSession || {};

  // Find local user in participants
  const localParticipant = participants.find((p) => p.userId === userId) || {
    userId,
    name: profile?.name || 'You',
    avatar_url: profile?.avatar_url,
    speaking: false,
    micMuted: !micConnected,
  };

  // Group participants into Speakers (unmuted or local) and Listeners (muted)
  const speakers = participants.length > 0
    ? participants.filter((p) => !p.micMuted || p.speaking || p.userId === userId)
    : [localParticipant];

  const listeners = participants.filter((p) => p.micMuted && !p.speaking && p.userId !== userId);

  // Local video ref
  const localVideoRef = useRef(null);
  useEffect(() => {
    if (localVideoRef.current && (localVideoStream || localScreenStream)) {
      localVideoRef.current.srcObject = localScreenStream || localVideoStream;
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
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back</span>
        </button>

        <div style={{ textAlign: 'center', maxWidth: '60%', overflow: 'hidden' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {channelName || 'Live Study Space'}
          </h2>
          <div style={{ fontSize: 11.5, color: 'var(--chatter-primary)', fontWeight: 600 }}>
            {serverName || 'Study Room'} · 🔴 LIVE SPACE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Speakers count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#D4D4D4' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span>{speakers.length}</span>
          </div>

          {/* Listeners count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#D4D4D4' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span>{listeners.length}</span>
          </div>
        </div>
      </header>

      {/* ── 2. Stage Area: Speakers & Video Tiles ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', maxWidth: 840, width: '100%', margin: '0 auto' }}>
        {/* Video stream container if camera or screen sharing is active */}
        {(cameraEnabled || isScreenSharing) && (
          <div style={{ marginBottom: 24, borderRadius: 18, overflow: 'hidden', background: '#111', border: '1px solid rgba(64, 227, 120, 0.4)', position: 'relative', maxHeight: 360 }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', maxHeight: 360, objectFit: 'contain', display: 'block' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {profile?.name || 'You'} {isScreenSharing ? '(Screen)' : '(Camera)'}
            </div>
          </div>
        )}

        {/* Section: Speakers on Stage */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
              const isSpeaking = speaker.speaking || (speaker.userId === userId && micConnected);
              const isMe = speaker.userId === userId;
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

                  <span style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: '#fff', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {speaker.name} {isMe && '(You)'}
                  </span>
                  <span style={{ fontSize: 11, color: isSpeaking ? 'var(--chatter-primary)' : 'var(--chatter-light-text)' }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--chatter-light-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
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
                  <span style={{ marginTop: 8, fontSize: 12, color: 'var(--chatter-light-text)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            padding: '10px 16px',
            fontSize: 13,
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
            onClick={toggleMic}
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: micConnected ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: micConnected ? '#0E0E0E' : '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: micConnected ? '0 4px 16px rgba(64, 227, 120, 0.35)' : 'none',
              transition: 'all 0.18s ease',
            }}
            title={micConnected ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micConnected ? (
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
            onClick={toggleCamera}
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
            onClick={toggleScreenShare}
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
            padding: '10px 18px',
            fontSize: 13,
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
