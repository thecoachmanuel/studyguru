'use client';

import React, { useRef, useEffect } from 'react';

/**
 * ChatterFloatingCallBar
 * Floating, docked persistent call & screen share bar.
 * Allows scholars to multitask across study room chat, notes, guru, and feed
 * while maintaining active voice, audio, and screen sharing without interruption.
 */
export default function ChatterFloatingCallBar({
  voiceSession,
  channelName,
  serverName,
  onExpand,
  onLeave,
}) {
  const videoRef = useRef(null);

  const {
    isMuted = false,
    handleToggleMute,
    toggleMic = handleToggleMute,
    isScreenSharing = false,
    handleStopScreenShare,
    localScreenStream,
    localVideoStream,
    remoteStreams = {},
    remoteScreenSharerId,
    participants = [],
    activeSpeakerIds = new Set(),
  } = voiceSession || {};

  const activeScreenStream = isScreenSharing
    ? localScreenStream || localVideoStream
    : remoteScreenSharerId
    ? remoteStreams[remoteScreenSharerId]
    : null;

  useEffect(() => {
    if (videoRef.current && activeScreenStream) {
      videoRef.current.srcObject = activeScreenStream;
      videoRef.current.play().catch(() => {});
    }
  }, [activeScreenStream]);

  const uniqueUserIds = new Set();
  (participants || []).forEach((p) => {
    let raw = p?.user_id || p?.userId || p?.profiles?.id || p?.id;
    if (typeof raw === 'string') {
      if (raw.startsWith('vp-')) {
        const withoutVp = raw.slice(3);
        const lastDash = withoutVp.lastIndexOf('-');
        raw = lastDash !== -1 ? withoutVp.slice(lastDash + 1) : withoutVp;
      }
      if (raw.includes('__')) raw = raw.split('__')[0];
    }
    const bId = String(raw || '').trim();
    if (bId) uniqueUserIds.add(bId);
  });
  if (voiceSession?.joinedChannelId && voiceSession?.userId) {
    let selfId = String(voiceSession.userId).trim();
    if (selfId.includes('__')) selfId = selfId.split('__')[0];
    if (selfId) uniqueUserIds.add(selfId);
  }
  const participantCount = Math.max(1, uniqueUserIds.size);
  const isSomeoneSpeaking = activeSpeakerIds && activeSpeakerIds.size > 0;

  return (
    <div
      className="studycord-floating-call-bar"
      onClick={onExpand}
      style={{
        position: 'fixed',
        bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 580,
        zIndex: 190,
        background: 'rgba(18, 18, 18, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(64, 227, 120, 0.4)',
        borderRadius: 20,
        boxShadow:
          '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 24px rgba(64, 227, 120, 0.2)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        cursor: 'pointer',
        animation: 'studycordSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
      }}
      title="Click to return to full study space"
    >
      {/* Left info & live pulsing indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* Pulsing Live Badge */}
        <div
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(64, 227, 120, 0.16)',
            border: '1px solid rgba(64, 227, 120, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              animation: 'studycordPulse 1.8s infinite',
            }}
          />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--chatter-primary)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        {/* Mini Picture-in-Picture Screen Share thumbnail if active */}
        {activeScreenStream && (
          <div
            style={{
              width: 48,
              height: 32,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#000',
              border: '1px solid rgba(64, 227, 120, 0.5)',
              flexShrink: 0,
              position: 'relative',
            }}
            title="Screen share active"
          >
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                fontSize: 8,
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: '1px 3px',
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              LIVE
            </span>
          </div>
        )}

        {/* Room Name, Screen status & Subtitle */}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span>{serverName || channelName || 'Study Room'}</span>
            {isScreenSharing && (
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(64, 227, 120, 0.2)',
                  color: 'var(--chatter-primary)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                🖥️ Sharing
              </span>
            )}
            {remoteScreenSharerId && !isScreenSharing && (
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '2px 6px',
                  borderRadius: 6,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                🖥️ Screen
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--chatter-light-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 1,
            }}
          >
            {channelName && channelName !== serverName && (
              <>
                <span style={{ color: '#fff', fontWeight: 600 }}>{channelName}</span>
                <span>·</span>
              </>
            )}
            <span style={{ color: isSomeoneSpeaking ? 'var(--chatter-primary)' : 'var(--chatter-light-text)' }}>
              {isSomeoneSpeaking ? '🎙️ Speaking now' : 'Connected to Call'}
            </span>
            <span>·</span>
            <span>{participantCount} in room</span>
          </div>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Stop screen share button if currently sharing */}
        {isScreenSharing && handleStopScreenShare && (
          <button
            type="button"
            onClick={handleStopScreenShare}
            title="Stop Screen Share"
            style={{
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '6px 10px',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>Stop Share</span>
          </button>
        )}

        {/* Quick Mic Mute / Unmute Toggle */}
        <button
          type="button"
          onClick={toggleMic}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: isMuted ? 'rgba(239, 68, 68, 0.18)' : 'rgba(64, 227, 120, 0.18)',
            border: isMuted ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(64, 227, 120, 0.4)',
            color: isMuted ? '#f87171' : 'var(--chatter-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Return to Call / Expand Button */}
        <button
          type="button"
          onClick={onExpand}
          title="Return to Study Space"
          style={{
            background: 'var(--chatter-primary)',
            border: 'none',
            color: '#0E0E0E',
            padding: '7px 14px',
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'transform 0.15s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <span className="studycord-hide-mobile-sm">Return</span>
        </button>

        {/* Quick Leave Call Button */}
        <button
          type="button"
          onClick={onLeave}
          title="Leave Call"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.12-8.68A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
        </button>
      </div>
    </div>
  );
}
