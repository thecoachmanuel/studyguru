'use client';

/**
 * VoicePanel — Study Room Video, Voice & Screen Sharing Conference.
 * Implements an industry-standard Google Meet & Microsoft Teams experience:
 * - Dynamic adaptive multi-participant video grid
 * - Active speaker detection with glowing emerald aura
 * - Dedicated presentation stage for live screen sharing with participant filmstrip
 * - Fullscreen room and individual tile expansion
 * - Floating glassmorphism bottom dock with Mic, Camera, Screen Share, and Leave controls
 * - Sliding Microsoft Teams-style participants side drawer
 * - Real-time WebRTC media, STUN/TURN, and Pusher synchronization
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiRequest } from '../lib/api';
import { getPusherClient } from '../lib/pusherClient';

function VideoStream({
  stream,
  muted = false,
  mirrored = false,
  screenContent = false,
  className = '',
  playRemoteMedia,
  forgetRemoteMediaElement,
}) {
  const mediaRef = useRef(null);

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;

    const attachAndPlay = () => {
      if (!mediaElement) return;
      if (mediaElement.srcObject !== (stream || null)) {
        mediaElement.srcObject = stream || null;
      }
      if (stream && stream.getTracks().length > 0) {
        if (muted) {
          mediaElement.play().catch((err) => {
            console.debug('[WebRTC] Local video preview playback failed:', err);
          });
        } else {
          playRemoteMedia?.(mediaElement);
        }
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
        if (!muted) {
          forgetRemoteMediaElement?.(mediaElement);
        }
        mediaElement.srcObject = null;
      };
    }

    return () => {
      if (!muted) {
        forgetRemoteMediaElement?.(mediaElement);
      }
      mediaElement.srcObject = null;
    };
  }, [stream, muted, playRemoteMedia, forgetRemoteMediaElement]);

  return (
    <video
      ref={mediaRef}
      className={[
        'voice-meet-tile__video',
        mirrored ? 'voice-meet-tile__video--mirrored' : '',
        screenContent ? 'voice-meet-tile__video--screen' : '',
        className,
      ].filter(Boolean).join(' ')}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}

export default function VoicePanel({
  channelId,
  channelName = 'Study Room',
  serverName = 'StudyGuru Hub',
  activeServerId,
  userId,
  profile,
  onMobileBack,
  voiceSession,
  onToggleRightPanel,
  rightPanelOpen,
  onRag1Activated,
  onOpenAiTab,
}) {
  const panelContainerRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI Layout Modes: 'grid' (Gallery) | 'spotlight' (Focus)
  const [layoutMode, setLayoutMode] = useState('grid');
  const [spotlightUserId, setSpotlightUserId] = useState(null);
  const [peopleDrawerOpen, setPeopleDrawerOpen] = useState(false);
  const [isRoomFullscreen, setIsRoomFullscreen] = useState(false);
  
  // Screen sharing view state
  const [focusedScreenShareUserId, setFocusedScreenShareUserId] = useState(null);
  const [fullscreenShareUserId, setFullscreenShareUserId] = useState(null);
  const [screenShareModalOpen, setScreenShareModalOpen] = useState(false);
  const [shareSystemAudio, setShareSystemAudio] = useState(true);
  
  // Meeting call duration timer (seconds)
  const [callDuration, setCallDuration] = useState(0);

  const screenShareFocusRef = useRef(null);
  const screenShareTileRefsRef = useRef(new Map());

  // Connection state
  const isJoinedHere = voiceSession.joinedChannelId === channelId;
  const isMuted = voiceSession.isMuted;
  const joining = voiceSession.joining;
  const cameraEnabled = voiceSession.cameraEnabled;
  const activeParticipants = isJoinedHere ? (voiceSession.participants || []) : participants;
  const activeLoading = isJoinedHere ? voiceSession.loading : loading;

  // Track room fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement &&
        (document.fullscreenElement === panelContainerRef.current || panelContainerRef.current?.contains(document.fullscreenElement))
      );
      setIsRoomFullscreen(isFs);

      if (!document.fullscreenElement) {
        setFullscreenShareUserId(null);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Meeting duration timer
  useEffect(() => {
    if (!isJoinedHere) {
      setCallDuration(0);
      return;
    }
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isJoinedHere]);

  const formattedCallDuration = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [callDuration]);

  // Screen share participants detection
  const remoteSharingParticipants = useMemo(() => {
    return activeParticipants.filter((p) => (
      p.user_id !== userId && Boolean(voiceSession.remoteScreenShareStates?.[p.user_id])
    ));
  }, [activeParticipants, userId, voiceSession.remoteScreenShareStates]);

  const isLocalSharing = voiceSession.isScreenSharing;
  const activeScreenSharePresenter = useMemo(() => {
    if (isLocalSharing) {
      return {
        user_id: userId,
        profiles: profile,
        isMe: true,
      };
    }
    if (remoteSharingParticipants.length > 0) {
      return (
        remoteSharingParticipants.find((p) => p.user_id === focusedScreenShareUserId) ||
        remoteSharingParticipants[0]
      );
    }
    return null;
  }, [isLocalSharing, userId, profile, remoteSharingParticipants, focusedScreenShareUserId]);

  const isPresentationActive = Boolean(activeScreenSharePresenter);

  // Auto-focus incoming screen share
  useEffect(() => {
    if (remoteSharingParticipants.length > 0 && !focusedScreenShareUserId) {
      setFocusedScreenShareUserId(remoteSharingParticipants[0].user_id);
    } else if (remoteSharingParticipants.length === 0 && !isLocalSharing) {
      setFocusedScreenShareUserId(null);
    }
  }, [remoteSharingParticipants, focusedScreenShareUserId, isLocalSharing]);

  // Fetch participants for this channel
  const fetchParticipants = useCallback(async () => {
    if (!channelId) return;
    try {
      const data = await apiRequest(`/api/channels/${channelId}/voice`);
      setParticipants(data?.participants || []);
    } catch (err) {
      console.warn('Failed to fetch voice participants:', err);
    }
    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 5000);
    return () => clearInterval(interval);
  }, [fetchParticipants]);

  // Realtime subscription for participants
  useEffect(() => {
    if (!channelId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const pusherChanName = `voice-channel-${channelId}`;
    let chan = null;

    try {
      chan = pusher.subscribe(pusherChanName);
      chan.bind('participant-joined', (newParticipant) => {
        setParticipants((prev) => {
          const without = prev.filter((p) => p.user_id !== newParticipant.user_id);
          return [...without, newParticipant];
        });
      });

      chan.bind('participant-left', ({ user_id }) => {
        setParticipants((prev) => prev.filter((p) => p.user_id !== user_id));
      });

      chan.bind('participant-updated', ({ user_id, is_muted }) => {
        setParticipants((prev) =>
          prev.map((p) => (p.user_id === user_id ? { ...p, is_muted } : p))
        );
      });
    } catch (e) {
      console.warn('VoicePanel pusher error:', e);
    }

    return () => {
      try {
        if (chan) pusher.unsubscribe(pusherChanName);
      } catch {}
    };
  }, [channelId]);

  // Actions
  const handleJoin = async () => {
    try {
      setError('');
      await voiceSession.handleJoin(channelId, channelName, activeServerId);
      fetchParticipants();
    } catch (err) {
      setError(voiceSession.error || 'Failed to join Study Room.');
    }
  };

  const handleLeave = async () => {
    setScreenShareModalOpen(false);
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    await voiceSession.handleLeave();
    fetchParticipants();
  };

  const handleToggleRoomFullscreen = async () => {
    if (isRoomFullscreen) {
      if (document.fullscreenElement) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        } catch (err) {
          console.warn('[Study Room] Exit fullscreen error:', err);
        }
      }
      setIsRoomFullscreen(false);
      return;
    }

    try {
      if (panelContainerRef.current?.requestFullscreen) {
        await panelContainerRef.current.requestFullscreen();
      } else if (panelContainerRef.current?.webkitRequestFullscreen) {
        await panelContainerRef.current.webkitRequestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setIsRoomFullscreen(true);
      }
    } catch (err) {
      console.warn('[Study Room] Fullscreen API fallback for mobile/browser:', err);
      setIsRoomFullscreen(true);
    }
  };

  const openScreenShareModal = () => {
    setShareSystemAudio(true);
    setScreenShareModalOpen(true);
  };

  const handleConfirmScreenShare = async (e) => {
    e.preventDefault();
    setScreenShareModalOpen(false);
    await voiceSession.handleStartScreenShare({ shareSystemAudio });
  };

  const handleToggleFullscreenShare = async (element) => {
    if (!element) return;
    if (document.fullscreenElement === element) {
      try { await document.exitFullscreen(); } catch {}
    } else {
      try { await element.requestFullscreen(); } catch (err) {
        console.error('Fullscreen share error:', err);
      }
    }
  };

  // Participant Media Resolver
  const getParticipantMedia = (participant) => {
    const isMe = participant.user_id === userId;
    const username = participant.profiles?.username || (isMe ? profile?.username : null) || 'Student';
    const avatarUrl = participant.profiles?.avatar_url || (isMe ? profile?.avatar_url : null);
    const initial = (username[0] || 'S').toUpperCase();

    const isSharingScreen = isMe
      ? voiceSession.isScreenSharing
      : Boolean(voiceSession.remoteScreenShareStates?.[participant.user_id]);

    const stream = isMe
      ? (isSharingScreen ? voiceSession.localScreenStream : voiceSession.localVideoStream)
      : voiceSession.remoteStreams?.[participant.user_id];

    const participantCameraState = isMe
      ? cameraEnabled
      : voiceSession.remoteCameraStates?.[participant.user_id];

    const hasLiveVideoTrack = Boolean(
      stream?.getVideoTracks().some((track) => track.readyState === 'live')
    );

    const hasLiveVideo = Boolean(
      hasLiveVideoTrack && (isSharingScreen || (isMe ? participantCameraState : participantCameraState !== false))
    );

    const isSpeaking = !participant.is_muted;
    const connStatus = isMe ? 'connected' : (voiceSession.connectionStatuses?.[participant.user_id] || 'connected');

    return {
      isMe,
      username,
      avatarUrl,
      initial,
      isSharingScreen,
      stream,
      hasLiveVideo,
      isSpeaking,
      connStatus,
    };
  };

  // Participant Video Tile Renderer
  const renderParticipantTile = (participant, { compact = false } = {}) => {
    const media = getParticipantMedia(participant);
    const isSpotlight = spotlightUserId === participant.user_id;

    return (
      <div
        key={`meet-tile-${participant.user_id}`}
        className={[
          'voice-meet-tile',
          compact ? 'voice-meet-tile--compact' : '',
          media.isSpeaking ? 'voice-meet-tile--speaking' : '',
          isSpotlight ? 'voice-meet-tile--spotlight' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="voice-meet-tile__media">
          {media.hasLiveVideo ? (
            <VideoStream
              stream={media.stream}
              muted={media.isMe}
              mirrored={media.isMe && !media.isSharingScreen}
              screenContent={media.isSharingScreen}
              playRemoteMedia={voiceSession.playRemoteMedia}
              forgetRemoteMediaElement={voiceSession.forgetRemoteMediaElement}
            />
          ) : (
            <div className="voice-meet-tile__avatar-box">
              <div className="voice-meet-avatar-wrapper">
                {media.avatarUrl ? (
                  <img
                    src={media.avatarUrl}
                    alt={media.username}
                    className="voice-meet-avatar"
                  />
                ) : (
                  <div className="voice-meet-avatar--fallback">
                    {media.initial}
                  </div>
                )}
                {media.isSpeaking && (
                  <div className="voice-meet-avatar-speaking-waves" />
                )}
              </div>
              {!compact && (
                <span className="voice-meet-avatar-name">{media.username}</span>
              )}
            </div>
          )}

          {/* Hover Action Controls (Spotlight / Fullscreen) */}
          <div className="voice-meet-tile__hover-controls">
            <button
              type="button"
              className="voice-meet-tile-action-btn"
              title={isSpotlight ? 'Unpin' : 'Pin to spotlight'}
              aria-label={isSpotlight ? 'Unpin' : 'Pin to spotlight'}
              onClick={() => {
                setSpotlightUserId(isSpotlight ? null : participant.user_id);
                setLayoutMode(isSpotlight ? 'grid' : 'spotlight');
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6a3 3 0 0 0-6 0v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bottom Translucent Info Pill */}
        <div className="voice-meet-tile__bottom-bar">
          <div className={`voice-meet-mic-badge ${participant.is_muted ? 'voice-meet-mic-badge--muted' : 'voice-meet-mic-badge--unmuted'}`} title={participant.is_muted ? 'Muted' : 'Speaking'}>
            {participant.is_muted ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </div>
          <span>{media.username}</span>
          {media.isMe && <span className="voice-meet-you-tag">You</span>}
          {media.isSharingScreen && <span className="voice-meet-screen-badge">Presenting</span>}
        </div>
      </div>
    );
  };

  // Determine grid density class based on participant count
  const count = activeParticipants.length;
  const gridDensityClass = count <= 1
    ? 'voice-meet-grid--1'
    : count === 2
    ? 'voice-meet-grid--2'
    : count <= 4
    ? 'voice-meet-grid--3-4'
    : count <= 6
    ? 'voice-meet-grid--5-6'
    : 'voice-meet-grid--many';

  return (
    <div
      ref={panelContainerRef}
      className={`voice-panel ${isRoomFullscreen ? 'voice-panel--fullscreen' : ''}`}
      id="voice-panel"
    >
      {/* Screen Share Confirmation Modal */}
      {screenShareModalOpen && (
        <div className="modal-overlay" onClick={() => setScreenShareModalOpen(false)}>
          <form
            className="modal-card screen-share-options-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="screen-share-title"
            onSubmit={handleConfirmScreenShare}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-card__title" id="screen-share-title">
              Share Your Screen in Study Room
            </h3>
            <p className="screen-share-options-modal__desc">
              Choose a tab, window, or entire screen to share live study material, slides, or code with your peers.
            </p>
            <label className="screen-share-options-modal__option">
              <input
                type="checkbox"
                checked={shareSystemAudio}
                onChange={(e) => setShareSystemAudio(e.target.checked)}
                className="screen-share-options-modal__checkbox"
              />
              <span className="screen-share-options-modal__option-text">
                <strong className="screen-share-options-modal__option-title">Share system audio</strong>
                <small className="screen-share-options-modal__option-sub">Stream video audio or music when sharing a browser tab.</small>
              </span>
            </label>
            <div className="modal-card__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setScreenShareModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary screen-share-options-modal__submit">
                Start Presenting
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Google Meet / Microsoft Teams Top Header */}
      <header className="voice-meet-header">
        <div className="voice-meet-header__left">
          {onMobileBack && (
            <button
              type="button"
              className="voice-meet-mobile-back"
              onClick={onMobileBack}
              aria-label="Back to channels"
              title="Back to channels"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <div className="voice-meet-header__title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <h2 className="voice-meet-header__title">{channelName}</h2>
            <span className="voice-meet-header__server-badge">{serverName}</span>
          </div>
        </div>

        {/* Center Live & Call Duration Status */}
        <div className="voice-meet-header__center">
          {isJoinedHere ? (
            <>
              <div className="voice-meet-live-pill">
                <span className="voice-meet-live-dot" />
                LIVE
              </div>
              <div className="voice-meet-timer" title="Call duration">
                {formattedCallDuration}
              </div>
              <div className="voice-meet-count-pill">
                {activeParticipants.length} {activeParticipants.length === 1 ? 'peer' : 'peers'}
              </div>
            </>
          ) : (
            <div className="voice-meet-count-pill">
              {activeParticipants.length} {activeParticipants.length === 1 ? 'in room' : 'in room'}
            </div>
          )}
        </div>

        {/* Right Action Tools: People Drawer, Fullscreen */}
        <div className="voice-meet-header__right">
          {isJoinedHere && (
            <button
              type="button"
              className={`voice-meet-header-btn ${peopleDrawerOpen ? 'voice-meet-header-btn--active' : ''}`}
              onClick={() => setPeopleDrawerOpen((open) => !open)}
              title="Toggle participants panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="voice-meet-header-btn__label">People ({activeParticipants.length})</span>
            </button>
          )}

          {/* Fullscreen Button (Google Meet / Teams Style) */}
          <button
            type="button"
            className={`voice-meet-header-btn ${isRoomFullscreen ? 'voice-meet-header-btn--active' : ''}`}
            onClick={handleToggleRoomFullscreen}
            title={isRoomFullscreen ? 'Exit full screen (ESC)' : 'Full screen (F)'}
            aria-label="Toggle full screen"
          >
            {isRoomFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
            <span className="voice-meet-header-btn__label">{isRoomFullscreen ? 'Exit' : 'Full Screen'}</span>
          </button>
        </div>
      </header>

      {/* Error or Warnings Bar */}
      {(error || voiceSession.error || voiceSession.cameraError || voiceSession.screenShareError) && (
        <div className="voice-meet-alert-bar" role="alert">
          <span className="voice-meet-alert-bar__msg">
            {error || voiceSession.error || voiceSession.cameraError || voiceSession.screenShareError}
          </span>
          <button
            type="button"
            className="voice-meet-alert-bar__dismiss"
            onClick={() => {
              setError('');
              voiceSession.setError('');
              voiceSession.setCameraError('');
              voiceSession.setScreenShareError('');
            }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Conference Stage */}
      <div className="voice-meet-stage">
        <div className="voice-meet-stage__canvas">
          {!isJoinedHere ? (
            /* Google Meet Pre-join Lobby */
            <div className="voice-meet-lobby">
              <div className="voice-meet-lobby-card">
                <div className="voice-meet-lobby-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
                <h3 className="voice-meet-lobby-title">Ready to join {channelName}?</h3>
                <p className="voice-meet-lobby-subtitle">
                  Connect with your classmates for real-time voice, video collaboration, and screen sharing.
                </p>

                <button
                  type="button"
                  className="voice-meet-lobby-join-btn"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <>
                      <svg className="spinner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Joining Study Room…
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Join Study Room
                    </>
                  )}
                </button>

                {activeParticipants.length > 0 && (
                  <div className="voice-meet-lobby-active-peers">
                    <div className="voice-meet-peers-stack">
                      {activeParticipants.slice(0, 4).map((p) => {
                        const uname = p.profiles?.username || 'User';
                        return p.profiles?.avatar_url ? (
                          <img key={p.id || p.user_id} src={p.profiles.avatar_url} alt={uname} />
                        ) : (
                          <div key={p.id || p.user_id} className="voice-meet-peer-initial">
                            {uname[0]?.toUpperCase() || '?'}
                          </div>
                        );
                      })}
                    </div>
                    <span>
                      {activeParticipants.length} {activeParticipants.length === 1 ? 'person is' : 'people are'} already in this study room
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : isPresentationActive ? (
            /* Screen Share Presentation Mode */
            <div className="voice-meet-presentation-stage">
              <div
                ref={screenShareFocusRef}
                className="voice-meet-presentation-hero"
              >
                {/* Presenter Banner */}
                <div className="voice-meet-presentation-hero__banner">
                  <span className="voice-meet-live-dot" />
                  <span>
                    {activeScreenSharePresenter.isMe
                      ? 'You are presenting your screen'
                      : `${activeScreenSharePresenter.profiles?.username || 'Presenter'} is presenting`}
                  </span>
                </div>

                {/* Presentation Controls */}
                <div className="voice-meet-presentation-hero__controls">
                  <button
                    type="button"
                    className="voice-meet-tile-action-btn"
                    title="Fullscreen presentation"
                    onClick={() => handleToggleFullscreenShare(screenShareFocusRef.current)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </button>
                </div>

                {/* Presentation Stream */}
                {activeScreenSharePresenter.isMe ? (
                  <VideoStream
                    stream={voiceSession.localScreenStream}
                    muted={true}
                    screenContent={true}
                    className="voice-meet-presentation-hero__video"
                  />
                ) : (
                  <VideoStream
                    stream={voiceSession.remoteStreams?.[activeScreenSharePresenter.user_id]}
                    muted={false}
                    screenContent={true}
                    className="voice-meet-presentation-hero__video"
                    playRemoteMedia={voiceSession.playRemoteMedia}
                    forgetRemoteMediaElement={voiceSession.forgetRemoteMediaElement}
                  />
                )}
              </div>

              {/* Bottom Filmstrip of Peers */}
              <div className="voice-meet-filmstrip">
                {activeParticipants.map((p) => renderParticipantTile(p, { compact: true }))}
              </div>
            </div>
          ) : layoutMode === 'spotlight' && spotlightUserId ? (
            /* Spotlight Mode (Focused Single Speaker) */
            <div className="voice-meet-presentation-stage">
              <div className="voice-meet-presentation-hero">
                {(() => {
                  const spotlightParticipant = activeParticipants.find((p) => p.user_id === spotlightUserId) || activeParticipants[0];
                  return spotlightParticipant ? renderParticipantTile(spotlightParticipant) : null;
                })()}
              </div>
              <div className="voice-meet-filmstrip">
                {activeParticipants
                  .filter((p) => p.user_id !== spotlightUserId)
                  .map((p) => renderParticipantTile(p, { compact: true }))}
              </div>
            </div>
          ) : (
            /* Dynamic Multi-Participant Grid */
            <div className={`voice-meet-grid ${gridDensityClass}`}>
              {activeParticipants.map((p) => renderParticipantTile(p))}
            </div>
          )}

          {/* Google Meet / Microsoft Teams Floating Bottom Dock */}
          {isJoinedHere && (
            <nav className="voice-meet-dock" aria-label="Meeting controls">
              {/* Mic Toggle */}
              <button
                type="button"
                className={`voice-meet-dock__btn ${isMuted ? 'voice-meet-dock__btn--muted-red' : ''}`}
                onClick={voiceSession.handleToggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {/* Camera Toggle */}
              <button
                type="button"
                className={`voice-meet-dock__btn ${cameraEnabled ? 'voice-meet-dock__btn--active-blue' : 'voice-meet-dock__btn--muted-red'}`}
                onClick={cameraEnabled ? () => voiceSession.handleTurnCameraOff() : voiceSession.handleTurnCameraOn}
                disabled={voiceSession.cameraBusy || voiceSession.screenShareBusy}
                title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
              >
                {cameraEnabled ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  </svg>
                )}
              </button>

              {/* Screen Share Toggle */}
              <button
                type="button"
                className={`voice-meet-dock__btn ${voiceSession.isScreenSharing ? 'voice-meet-dock__btn--active-green' : ''}`}
                onClick={voiceSession.isScreenSharing ? () => voiceSession.handleStopScreenShare() : openScreenShareModal}
                disabled={voiceSession.screenShareBusy || voiceSession.cameraBusy}
                title={voiceSession.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                aria-label={voiceSession.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>

              {/* Fullscreen Room Button */}
              <button
                type="button"
                className={`voice-meet-dock__btn ${isRoomFullscreen ? 'voice-meet-dock__btn--active-blue' : ''}`}
                onClick={handleToggleRoomFullscreen}
                title={isRoomFullscreen ? 'Exit full screen' : 'Full screen'}
                aria-label="Toggle full screen"
              >
                {isRoomFullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>

              {/* People Drawer Toggle */}
              <button
                type="button"
                className={`voice-meet-dock__btn ${peopleDrawerOpen ? 'voice-meet-dock__btn--active-blue' : ''}`}
                onClick={() => setPeopleDrawerOpen((open) => !open)}
                title="View participants"
                aria-label="View participants"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="voice-meet-dock__btn-badge">{activeParticipants.length}</span>
              </button>

              {/* Red Pill Leave Button */}
              <button
                type="button"
                className="voice-meet-dock__leave-btn"
                onClick={handleLeave}
                title="Leave Study Room"
                aria-label="Leave Study Room"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
                <span className="voice-meet-dock__leave-label">Leave Room</span>
              </button>
            </nav>
          )}
        </div>

        {/* Microsoft Teams Style Slide-in People Drawer */}
        {isJoinedHere && peopleDrawerOpen && (
          <>
            <div
              className="voice-meet-drawer-backdrop"
              onClick={() => setPeopleDrawerOpen(false)}
              aria-hidden="true"
            />
            <aside className="voice-meet-drawer" aria-label="Meeting participants">
              <header className="voice-meet-drawer__header">
                <h3>People in Study Room ({activeParticipants.length})</h3>
                <button
                  type="button"
                  className="voice-meet-drawer__close"
                  onClick={() => setPeopleDrawerOpen(false)}
                  aria-label="Close people drawer"
                >
                  ✕
                </button>
              </header>

            <div className="voice-meet-drawer__list">
              {activeParticipants.map((p) => {
                const media = getParticipantMedia(p);
                return (
                  <div key={`drawer-user-${p.user_id}`} className="voice-meet-drawer-item">
                    {media.avatarUrl ? (
                      <img src={media.avatarUrl} alt="" className="voice-meet-drawer-item__avatar" />
                    ) : (
                      <div className="voice-meet-drawer-item__avatar-fallback">
                        {media.initial}
                      </div>
                    )}
                    <div className="voice-meet-drawer-item__info">
                      <span className="voice-meet-drawer-item__name">
                        {media.username}
                        {media.isMe && <span className="voice-meet-you-tag">You</span>}
                      </span>
                      <span className="voice-meet-drawer-item__status">
                        {media.connStatus}
                      </span>
                    </div>

                    <div className={`voice-meet-mic-badge ${p.is_muted ? 'voice-meet-mic-badge--muted' : 'voice-meet-mic-badge--unmuted'}`}>
                      {p.is_muted ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  </div>
);
}
