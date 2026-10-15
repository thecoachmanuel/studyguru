import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { getPusherClient } from '../lib/pusherClient';

const AUTOPLAY_WARNING = 'Your browser blocked automatic media playback. Click the page, then try again.';
const PLAYBACK_RETRY_EVENTS = ['pointerdown', 'click', 'keydown', 'touchstart'];

const unlockAudioOnMobile = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!window.__studycord_audio_ctx) {
        window.__studycord_audio_ctx = new AudioCtx();
      }
      if (window.__studycord_audio_ctx.state === 'suspended') {
        window.__studycord_audio_ctx.resume().catch(() => {});
      }
    }
  } catch {}
};

export function useVoiceSession(userId, profile = null) {
  const [joinedChannelId, setJoinedChannelId] = useState(null);
  const [joinedChannelName, setJoinedChannelName] = useState(null);
  const [joinedServerId, setJoinedServerId] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [micConnected, setMicConnected] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [turnWarning, setTurnWarning] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareBusy, setScreenShareBusy] = useState(false);
  const [screenShareError, setScreenShareError] = useState('');
  const [autoplayWarning, setAutoplayWarning] = useState('');
  const [localVideoStream, setLocalVideoStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteCameraStates, setRemoteCameraStates] = useState({});
  const [remoteScreenShareStates, setRemoteScreenShareStates] = useState({});

  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const cameraEnabledRef = useRef(false);
  const cameraStateUpdatedAtRef = useRef(0);
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null);
  const screenShareStateUpdatedAtRef = useRef(0);
  const peerConnectionsRef = useRef({});
  const videoSendersRef = useRef({});
  const screenAudioSendersRef = useRef({});
  const remoteStreamsRef = useRef({});
  const remoteCameraStateTimesRef = useRef({});
  const remoteScreenShareStateTimesRef = useRef({});
  const makingOfferRef = useRef({});
  const negotiationPendingRef = useRef({});
  const ignoreOfferRef = useRef({});
  const settingRemoteAnswerRef = useRef({});
  const stopCameraRef = useRef(null);
  const stopScreenShareRef = useRef(null);
  const screenShareStoppingRef = useRef(false);
  const pendingPlaybackElementsRef = useRef(new Set());
  const playbackRetryListenerRef = useRef(null);
  const playbackRetryInProgressRef = useRef(false);
  const participantsRef = useRef([]);
  const pendingCandidatesRef = useRef({});
  const reconnectTimeoutsRef = useRef({});
  const reconnectingRef = useRef({});
  const lastAbsentRef = useRef({}); // Tracks when a user first went missing: { userId: timestamp }
  const explicitlyLeftRef = useRef(new Set()); // Track users who explicitly left (via DELETE event)
  const iceServersRef = useRef([
    { urls: 'stun:stun.l.google.com:19302' }
  ]);
  const offerWaitTimersRef = useRef({});
  const negotiatePeerRef = useRef(null);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Authoritative local mute state so remote sync never unexpectedly mutes local mic
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const isLocalMutedRef = useRef(false);

  // Derived variables
  const isJoined = Boolean(joinedChannelId);
  const isMuted = isLocalMuted;

  const currentChannelIdRef = useRef(joinedChannelId);
  const currentUserIdRef = useRef(userId);
  const isJoinedRef = useRef(isJoined);

  useEffect(() => {
    currentChannelIdRef.current = joinedChannelId;
    currentUserIdRef.current = userId;
    isJoinedRef.current = isJoined;
  }, [joinedChannelId, userId, isJoined]);

  const logVideoDiagnostic = useCallback((event, remoteUserId, details = {}) => {
    console.debug('[WebRTC][video]', {
      event,
      localUserId: currentUserIdRef.current,
      remoteUserId,
      ...details,
    });
  }, []);

  // ---------- remote media playback helpers ----------
  const removePlaybackRetryListeners = useCallback(() => {
    const listener = playbackRetryListenerRef.current;
    if (!listener) return;

    PLAYBACK_RETRY_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, listener, true);
    });
    playbackRetryListenerRef.current = null;
  }, []);

  const clearPendingMediaPlayback = useCallback(() => {
    pendingPlaybackElementsRef.current.clear();
    removePlaybackRetryListeners();
    setAutoplayWarning('');
  }, [removePlaybackRetryListeners]);

  const retryPendingMediaPlayback = useCallback(async () => {
    if (playbackRetryInProgressRef.current) return;
    playbackRetryInProgressRef.current = true;

    const pendingElements = Array.from(pendingPlaybackElementsRef.current);

    try {
      await Promise.all(pendingElements.map(async (mediaElement) => {
        if (!mediaElement.isConnected || !mediaElement.srcObject) {
          pendingPlaybackElementsRef.current.delete(mediaElement);
          return;
        }

        try {
          await mediaElement.play();
          pendingPlaybackElementsRef.current.delete(mediaElement);
        } catch (err) {
          if (err?.name !== 'NotAllowedError') {
            pendingPlaybackElementsRef.current.delete(mediaElement);
            console.error('[WebRTC] Remote media playback retry failed:', err);
          }
        }
      }));
    } finally {
      playbackRetryInProgressRef.current = false;
    }

    if (pendingPlaybackElementsRef.current.size === 0) {
      removePlaybackRetryListeners();
      setAutoplayWarning('');
    }
  }, [removePlaybackRetryListeners]);

  const playRemoteMedia = useCallback((mediaElement) => {
    if (!mediaElement) return Promise.resolve();

    return mediaElement.play().then(() => {
      pendingPlaybackElementsRef.current.delete(mediaElement);
      if (pendingPlaybackElementsRef.current.size === 0) {
        removePlaybackRetryListeners();
        setAutoplayWarning('');
      }
    }).catch((err) => {
      if (err?.name !== 'NotAllowedError') {
        console.error('[WebRTC] Remote media playback failed:', err);
        return;
      }

      pendingPlaybackElementsRef.current.add(mediaElement);
      setAutoplayWarning(AUTOPLAY_WARNING);

      if (!playbackRetryListenerRef.current) {
        playbackRetryListenerRef.current = retryPendingMediaPlayback;
        PLAYBACK_RETRY_EVENTS.forEach((eventName) => {
          document.addEventListener(eventName, retryPendingMediaPlayback, true);
        });
      }
    });
  }, [removePlaybackRetryListeners, retryPendingMediaPlayback]);

  const forgetRemoteMediaElement = useCallback((mediaElement) => {
    if (!mediaElement) return;

    pendingPlaybackElementsRef.current.delete(mediaElement);
    if (pendingPlaybackElementsRef.current.size === 0) {
      removePlaybackRetryListeners();
      setAutoplayWarning('');
    }
  }, [removePlaybackRetryListeners]);

  // ---------- local media helpers ----------
  const cleanupLocalAudio = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
    }
    screenTrackRef.current = null;
    screenAudioTrackRef.current = null;
    screenAudioSendersRef.current = {};
    screenShareStoppingRef.current = false;
    screenShareStateUpdatedAtRef.current = Date.now();
    setIsScreenSharing(false);
    setScreenShareBusy(false);
    setScreenShareError('');
    setLocalScreenStream(null);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    cameraTrackRef.current = null;
    cameraEnabledRef.current = false;
    cameraStateUpdatedAtRef.current = Date.now();
    setCameraEnabled(false);
    setCameraBusy(false);
    setLocalVideoStream(null);
    setMicConnected(false);
  }, []);

  const initLocalAudio = useCallback(async (currentMuteState) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      setMicConnected(false);
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setMicConnected(true);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !currentMuteState;

        // Retroactively attach audio track to any existing peer connections created before getUserMedia completed
        Object.entries(peerConnectionsRef.current).forEach(([otherUserId, pc]) => {
          if (pc && pc.signalingState !== 'closed') {
            const senders = pc.getSenders();
            const audioSender = senders.find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(audioTrack).catch((err) => {
                console.warn(`[WebRTC] Failed to replaceTrack audio for ${otherUserId}:`, err);
              });
            } else {
              try {
                pc.addTrack(audioTrack, stream);
                negotiatePeerRef.current?.(otherUserId, 'audio-track-attached');
              } catch (err) {
                console.warn(`[WebRTC] Failed to addTrack audio for ${otherUserId}:`, err);
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('Microphone access denied or failed:', err);
      setMicConnected(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access to use voice channels.');
      } else {
        setError('Failed to access microphone. Please check your audio devices.');
      }
      throw err;
    }
  }, []);

  // ---------- WebRTC signaling & peer connection helpers ----------
  const updateCallStatus = useCallback(() => {
    const connections = Object.values(peerConnectionsRef.current);
    if (connections.length === 0) {
      setCallStatus('');
      return;
    }

    const states = connections.map((pc) => pc.iceConnectionState);
    if (states.includes('connected')) {
      setCallStatus('Voice connected');
    } else if (states.some((s) => s === 'checking' || s === 'new')) {
      setCallStatus('Connecting...');
    } else if (states.every((s) => s === 'failed' || s === 'disconnected' || s === 'closed')) {
      setCallStatus('Disconnected');
    }
  }, []);

  const cleanupPeerConnection = useCallback((otherUserId) => {
    console.log(`[WebRTC] Cleaning up connection for user: ${otherUserId}`);
    const pc = peerConnectionsRef.current[otherUserId];
    if (pc) {
      const remoteStream = remoteStreamsRef.current[otherUserId];
      remoteStream?.getTracks().forEach((track) => track.stop());
      try {
        pc.close();
      } catch (e) {}
      delete peerConnectionsRef.current[otherUserId];
    }
    delete videoSendersRef.current[otherUserId];
    delete screenAudioSendersRef.current[otherUserId];
    delete remoteStreamsRef.current[otherUserId];
    delete remoteCameraStateTimesRef.current[otherUserId];
    delete remoteScreenShareStateTimesRef.current[otherUserId];
    delete makingOfferRef.current[otherUserId];
    delete negotiationPendingRef.current[otherUserId];
    delete ignoreOfferRef.current[otherUserId];
    delete settingRemoteAnswerRef.current[otherUserId];

    // Clear any pending ICE candidates for this user
    delete pendingCandidatesRef.current[otherUserId];

    // Clear any pending offer wait timer for this user
    if (offerWaitTimersRef.current[otherUserId]) {
      clearTimeout(offerWaitTimersRef.current[otherUserId]);
      delete offerWaitTimersRef.current[otherUserId];
    }

    // Clear any reconnect timeout for this user
    if (reconnectTimeoutsRef.current[otherUserId]) {
      clearTimeout(reconnectTimeoutsRef.current[otherUserId]);
      delete reconnectTimeoutsRef.current[otherUserId];
    }
    delete reconnectingRef.current[otherUserId];
    delete lastAbsentRef.current[otherUserId];
    explicitlyLeftRef.current.delete(otherUserId);

    const audioElement = document.getElementById(`remote-audio-${otherUserId}`);
    if (audioElement) {
      forgetRemoteMediaElement(audioElement);
      audioElement.srcObject = null;
      audioElement.remove();
    }

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[otherUserId];
      return next;
    });
    setRemoteCameraStates((prev) => {
      const next = { ...prev };
      delete next[otherUserId];
      return next;
    });
    setRemoteScreenShareStates((prev) => {
      const next = { ...prev };
      delete next[otherUserId];
      return next;
    });
    setConnectionStatuses((prev) => {
      const next = { ...prev };
      delete next[otherUserId];
      return next;
    });
    updateCallStatus();
  }, [forgetRemoteMediaElement, updateCallStatus]);

  const cleanupAllCalls = useCallback((reason) => {
    if (!reason) {
      console.log('[WebRTC] cleanupAllCalls called without reason, ignoring');
      return;
    }
    console.log(`[WebRTC] Cleaning up all active peer connections. Reason: ${reason}`);
    // Clear all reconnect timeouts first
    Object.keys(reconnectTimeoutsRef.current).forEach((uid) => {
      clearTimeout(reconnectTimeoutsRef.current[uid]);
    });
    reconnectTimeoutsRef.current = {};
    reconnectingRef.current = {};
    lastAbsentRef.current = {};
    explicitlyLeftRef.current.clear();

    Object.keys(peerConnectionsRef.current).forEach((otherUserId) => {
      cleanupPeerConnection(otherUserId);
    });
    clearPendingMediaPlayback();
    remoteScreenShareStateTimesRef.current = {};
    setRemoteScreenShareStates({});
    setConnectionStatuses({});
    setCallStatus('');
  }, [cleanupPeerConnection, clearPendingMediaPlayback]);

  const sendSignal = useCallback(async (receiverId, signalType, signalData) => {
    if (!joinedChannelId || !userId) return;
    console.log(`[WebRTC] Sending signaling data (${signalType}) to user ${receiverId}`);
    try {
      await apiRequest(`/api/channels/${joinedChannelId}/voice/signal`, {
        method: 'POST',
        body: JSON.stringify({
          receiver_id: receiverId,
          signal_type: signalType,
          signal_data: signalData,
        }),
      });
    } catch (signalErr) {
      console.warn(`[WebRTC] Failed to send signal ${signalType} to ${receiverId}:`, signalErr);
    }
  }, [joinedChannelId, userId]);

  const negotiatePeer = useCallback(async (otherUserId, reason) => {
    const pc = peerConnectionsRef.current[otherUserId];
    if (!pc || pc.signalingState === 'closed') return false;

    logVideoDiagnostic('negotiation-requested', otherUserId, {
      reason,
      signalingState: pc.signalingState,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });

    if (makingOfferRef.current[otherUserId]) {
      logVideoDiagnostic('negotiation-deferred', otherUserId, {
        reason,
        makingOffer: true,
        signalingState: pc.signalingState,
      });
      return false;
    }
    if (pc.signalingState !== 'stable') {
      negotiationPendingRef.current[otherUserId] = true;
      logVideoDiagnostic('negotiation-deferred', otherUserId, {
        reason,
        makingOffer: false,
        signalingState: pc.signalingState,
      });
      return false;
    }

    try {
      negotiationPendingRef.current[otherUserId] = false;
      makingOfferRef.current[otherUserId] = true;
      const offer = await pc.createOffer();
      logVideoDiagnostic('offer-created', otherUserId, {
        reason,
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      await pc.setLocalDescription(offer);
      await sendSignal(otherUserId, 'offer', pc.localDescription);
      logVideoDiagnostic('offer-sent', otherUserId, {
        reason,
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      return true;
    } catch (err) {
      console.error(`[WebRTC] Error negotiating with user ${otherUserId}:`, err);
      return false;
    } finally {
      makingOfferRef.current[otherUserId] = false;
    }
  }, [logVideoDiagnostic, sendSignal]);

  useEffect(() => {
    negotiatePeerRef.current = negotiatePeer;
  }, [negotiatePeer]);

  const createPeerConnection = useCallback((otherUserId) => {
    console.log(`[WebRTC] Creating peer connection for user: ${otherUserId}`);

    if (peerConnectionsRef.current[otherUserId]) {
      cleanupPeerConnection(otherUserId);
    }

    const hasTurn = iceServersRef.current.some(srv => srv.urls && (srv.urls.includes('turn:') || srv.urls.includes('turns:')));
    console.log(`[WebRTC] RTCPeerConnection is using ${hasTurn ? 'Metered TURN' : 'STUN-only'} configuration.`);
    const rtcConfig = {
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
    };
    const pc = new RTCPeerConnection(rtcConfig);

    peerConnectionsRef.current[otherUserId] = pc;

    setConnectionStatuses((prev) => ({
      ...prev,
      [otherUserId]: 'connecting',
    }));

    if (localStreamRef.current) {
      console.log(`[WebRTC] Adding local audio tracks to peer connection for ${otherUserId}`);
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.warn(`[WebRTC] localStreamRef.current is empty when building connection for ${otherUserId}`);
    }

    // Reserve one video sender in the initial negotiation. Screen share takes
    // precedence over camera for peers that join while sharing is already active.
    const activeVideoTrack = screenTrackRef.current || cameraTrackRef.current;
    const activeVideoStream = screenTrackRef.current
      ? screenStreamRef.current
      : localStreamRef.current;
    const videoTransceiver = activeVideoTrack
      ? pc.addTransceiver(activeVideoTrack, {
        direction: 'sendrecv',
        streams: activeVideoStream ? [activeVideoStream] : [],
      })
      : pc.addTransceiver('video', { direction: 'sendrecv' });
    videoSendersRef.current[otherUserId] = videoTransceiver.sender;
    logVideoDiagnostic('peer-video-sender-prepared', otherUserId, {
      senderTrackId: videoTransceiver.sender.track?.id || null,
      cameraEnabled: cameraEnabledRef.current,
      screenSharing: Boolean(screenTrackRef.current),
    });

    const activeScreenAudioTrack = screenAudioTrackRef.current;
    if (activeScreenAudioTrack?.readyState === 'live' && screenStreamRef.current) {
      screenAudioSendersRef.current[otherUserId] = pc.addTrack(
        activeScreenAudioTrack,
        screenStreamRef.current,
      );
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Sending ICE candidate to user ${otherUserId}`);
        sendSignal(otherUserId, 'ice-candidate', event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const connState = pc.connectionState;
      console.log(`[WebRTC] Connection state for user ${otherUserId}: ${connState}`);

      setConnectionStatuses((prev) => {
        let status = 'disconnected';
        if (connState === 'connected') status = 'connected';
        else if (connState === 'connecting') status = 'connecting';
        else if (connState === 'disconnected') status = 'disconnected';
        else if (connState === 'failed') status = 'disconnected';
        
        if (reconnectTimeoutsRef.current[otherUserId] && status === 'disconnected') {
          status = 'reconnecting';
        }
        return { ...prev, [otherUserId]: status };
      });

      if (connState === 'failed') {
        console.log(`[WebRTC] failed detected, waiting 15s for user ${otherUserId}`);
        triggerReconnect(otherUserId);
      } else if (connState === 'connected' || connState === 'completed') {
        if (reconnectTimeoutsRef.current[otherUserId]) {
          console.log(`[WebRTC] failure recovered, cancelling reconnect for user ${otherUserId}`);
          clearTimeout(reconnectTimeoutsRef.current[otherUserId]);
          delete reconnectTimeoutsRef.current[otherUserId];
        }
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state for user ${otherUserId}: ${pc.signalingState}`);
      if (pc.signalingState === 'stable' && negotiationPendingRef.current[otherUserId]) {
        negotiatePeer(otherUserId, 'deferred-until-stable');
      }
    };

    pc.onnegotiationneeded = async () => {
      logVideoDiagnostic('negotiationneeded-fired', otherUserId, {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      await negotiatePeer(otherUserId, 'negotiationneeded');
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[WebRTC] ICE connection state for user ${otherUserId}: ${state}`);

      if (state === 'connected' || state === 'completed') {
        if (reconnectTimeoutsRef.current[otherUserId]) {
          console.log(`[WebRTC] failure recovered, cancelling reconnect for user ${otherUserId}`);
          clearTimeout(reconnectTimeoutsRef.current[otherUserId]);
          delete reconnectTimeoutsRef.current[otherUserId];
        }
        delete reconnectingRef.current[otherUserId];
      } else if (state === 'disconnected') {
        console.log(`[WebRTC] disconnected ignored, waiting for browser recovery for user ${otherUserId}`);
      } else if (state === 'failed') {
        console.log(`[WebRTC] ICE failed for user ${otherUserId}, ignoring and waiting for connectionState to transition`);
      }

      updateCallStatus();
    };

    pc.ontrack = (event) => {
      let remoteStream = remoteStreamsRef.current[otherUserId];
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current[otherUserId] = remoteStream;
      }

      if (event.track.kind === 'video') {
        // Remove any old/stale video tracks so incoming live track is always primary
        remoteStream.getVideoTracks().forEach((oldTrack) => {
          if (oldTrack.id !== event.track.id) {
            remoteStream.removeTrack(oldTrack);
          }
        });
      }

      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      logVideoDiagnostic('remote-track', otherUserId, {
        trackKind: event.track.kind,
        trackId: event.track.id,
        trackReadyState: event.track.readyState,
        trackMuted: event.track.muted,
        eventStreamsLength: event.streams.length,
        streamId: event.streams[0]?.id || remoteStream.id,
        remoteStreamTrackKinds: remoteStream.getTracks().map((track) => track.kind),
      });

      event.track.onended = () => {
        const currentStream = remoteStreamsRef.current[otherUserId];
        if (currentStream) {
          currentStream.removeTrack(event.track);
          const clonedAfterEnd = new MediaStream(currentStream.getTracks());
          remoteStreamsRef.current[otherUserId] = clonedAfterEnd;
          setRemoteStreams((prev) => ({ ...prev, [otherUserId]: clonedAfterEnd }));
        }
        if (event.track.kind === 'video') {
          setRemoteCameraStates((prev) => ({ ...prev, [otherUserId]: false }));
        }
      };
      if (event.track.kind === 'video') {
        event.track.onunmute = () => {
          logVideoDiagnostic('remote-video-unmuted', otherUserId, {
            trackId: event.track.id,
            trackReadyState: event.track.readyState,
          });
          setRemoteCameraStates((prev) => ({ ...prev, [otherUserId]: true }));
        };
        event.track.onmute = () => {
          logVideoDiagnostic('remote-video-muted', otherUserId, {
            trackId: event.track.id,
            trackReadyState: event.track.readyState,
          });
          setRemoteCameraStates((prev) => ({ ...prev, [otherUserId]: false }));
        };
      }

      if (event.track.kind === 'audio') {
        let audioElement = document.getElementById(`remote-audio-${otherUserId}`);
        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.id = `remote-audio-${otherUserId}`;
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.muted = false;
          audioElement.setAttribute('playsinline', 'true');
          audioElement.setAttribute('webkit-playsinline', 'true');
          audioElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
          document.body.appendChild(audioElement);
        }
        audioElement.srcObject = remoteStream;
        playRemoteMedia(audioElement);
        unlockAudioOnMobile();
      }

      // Clone MediaStream with current tracks to trigger React state reactivity and component re-render
      const clonedStream = new MediaStream(remoteStream.getTracks());
      remoteStreamsRef.current[otherUserId] = clonedStream;
      setRemoteStreams((prev) => ({ ...prev, [otherUserId]: clonedStream }));
      updateCallStatus();
    };

    // Explicit ephemeral state keeps camera-off placeholders accurate even while
    // the negotiated video receiver remains present.
    const cameraState = {
      enabled: cameraEnabledRef.current,
      updatedAt: cameraStateUpdatedAtRef.current,
    };
    logVideoDiagnostic('camera-state-sending', otherUserId, cameraState);
    sendSignal(otherUserId, 'camera-state', cameraState);

    const screenShareState = {
      enabled: Boolean(screenTrackRef.current),
      updatedAt: screenShareStateUpdatedAtRef.current,
    };
    logVideoDiagnostic('screen-share-state-sending', otherUserId, screenShareState);
    sendSignal(otherUserId, 'screen-share-state', screenShareState);

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSignal, cleanupPeerConnection, updateCallStatus, negotiatePeer, logVideoDiagnostic, playRemoteMedia]);

  // ---------- reconnect helper ----------
  const reconnectPeer = useCallback(async (otherUserId) => {
    // Prevent duplicate reconnect attempts
    if (reconnectingRef.current[otherUserId]) {
      console.log(`[WebRTC] Reconnect already in progress for ${otherUserId}, skipping`);
      return;
    }
    reconnectingRef.current[otherUserId] = true;

    // Clear any pending reconnect timeout
    if (reconnectTimeoutsRef.current[otherUserId]) {
      clearTimeout(reconnectTimeoutsRef.current[otherUserId]);
      delete reconnectTimeoutsRef.current[otherUserId];
    }

    console.log(`[WebRTC] Reconnecting peer connection for user ${otherUserId}`);
    cleanupPeerConnection(otherUserId);

    setConnectionStatuses((prev) => ({
      ...prev,
      [otherUserId]: 'connecting',
    }));

    // Only the initiator (smaller userId) re-creates and sends a new offer.
    // The other side will receive the offer via signaling and respond.
    const currentUserId = currentUserIdRef.current;
    if (currentUserId && currentUserId < otherUserId) {
      console.log(`[WebRTC] Re-creating connection and sending new offer to ${otherUserId}`);
      createPeerConnection(otherUserId);
      try {
        await negotiatePeer(otherUserId, 'reconnect');
      } catch (err) {
        console.error(`[WebRTC] Error creating/sending reconnect offer to ${otherUserId}:`, err);
      }
    } else {
      console.log(`[WebRTC] Waiting for reconnect offer from ${otherUserId} (they are initiator)`);
    }

    // Allow future reconnects after a cooldown
    setTimeout(() => {
      delete reconnectingRef.current[otherUserId];
    }, 3000);
  }, [cleanupPeerConnection, createPeerConnection, negotiatePeer]);

  const triggerReconnect = useCallback((otherUserId) => {
    // 1. Only reconnect if the peer is still present in voice_participants
    const isPresent = participantsRef.current.some((p) => p.user_id === otherUserId);
    if (!isPresent) {
      console.log(`[WebRTC] Peer ${otherUserId} is no longer in channel, skipping reconnect`);
      return;
    }

    // 2. Do not create multiple reconnect timers for same user
    if (reconnectTimeoutsRef.current[otherUserId]) {
      console.log(`[WebRTC] Reconnect timer already exists for ${otherUserId}, skipping`);
      return;
    }

    setConnectionStatuses((prev) => ({
      ...prev,
      [otherUserId]: 'reconnecting',
    }));

    console.log(`[WebRTC] Scheduling reconnect for ${otherUserId} in 15 seconds`);
    reconnectTimeoutsRef.current[otherUserId] = setTimeout(async () => {
      delete reconnectTimeoutsRef.current[otherUserId];

      const stillPresent = participantsRef.current.some((p) => p.user_id === otherUserId);
      if (!stillPresent) {
        console.log(`[WebRTC] Peer ${otherUserId} left during reconnect delay, aborting reconnect`);
        setConnectionStatuses((prev) => {
          const next = { ...prev };
          delete next[otherUserId];
          return next;
        });
        return;
      }

      const pc = peerConnectionsRef.current[otherUserId];
      if (pc && pc.connectionState === 'failed') {
        console.log(`[WebRTC] reconnecting after 15s confirmed failure for user ${otherUserId}`);
        await reconnectPeer(otherUserId);
      } else {
        console.log(`[WebRTC] Peer connection for ${otherUserId} is no longer in failed state, cancelling reconnect execution`);
      }
    }, 15000);
  }, [reconnectPeer]);

  const flushPendingIceCandidates = useCallback(async (pc, otherUserId) => {
    const queued = pendingCandidatesRef.current[otherUserId];
    if (queued && queued.length > 0) {
      console.log(`[WebRTC] Processing buffered ICE candidates (${queued.length}) for user ${otherUserId}`);
      for (const candidateData of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          console.log(`[WebRTC] Added buffered ICE candidate for user ${otherUserId}`);
        } catch (err) {
          console.error(`[WebRTC] Error adding buffered ICE candidate for ${otherUserId}:`, err);
        }
      }
      delete pendingCandidatesRef.current[otherUserId];
    }
  }, []);

  const handleOffer = useCallback(async (senderId, offerSdp) => {
    if (offerWaitTimersRef.current[senderId]) {
      clearTimeout(offerWaitTimersRef.current[senderId]);
      delete offerWaitTimersRef.current[senderId];
    }

    let pc = peerConnectionsRef.current[senderId];
    if (!pc) {
      pc = createPeerConnection(senderId);
    }

    const polite = String(currentUserIdRef.current) > String(senderId);
    const readyForOffer = !makingOfferRef.current[senderId]
      && (pc.signalingState === 'stable' || settingRemoteAnswerRef.current[senderId]);
    const offerCollision = !readyForOffer;
    ignoreOfferRef.current[senderId] = !polite && offerCollision;
    logVideoDiagnostic('offer-received', senderId, {
      polite,
      offerCollision,
      ignored: ignoreOfferRef.current[senderId],
      signalingState: pc.signalingState,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });
    if (ignoreOfferRef.current[senderId]) return;

    try {
      if (offerCollision && pc.signalingState !== 'stable') {
        await pc.setLocalDescription({ type: 'rollback' });
        logVideoDiagnostic('offer-collision-rolled-back', senderId, {
          signalingState: pc.signalingState,
        });
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      await flushPendingIceCandidates(pc, senderId);
      const answer = await pc.createAnswer();
      logVideoDiagnostic('answer-created', senderId, {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      await pc.setLocalDescription(answer);
      await sendSignal(senderId, 'answer', pc.localDescription);
      logVideoDiagnostic('answer-sent', senderId, {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from user ${senderId}:`, err);
    }
  }, [createPeerConnection, sendSignal, flushPendingIceCandidates, logVideoDiagnostic]);

  const handleAnswer = useCallback(async (senderId, answerSdp) => {
    if (offerWaitTimersRef.current[senderId]) {
      clearTimeout(offerWaitTimersRef.current[senderId]);
      delete offerWaitTimersRef.current[senderId];
    }

    const pc = peerConnectionsRef.current[senderId];
    if (pc) {
      logVideoDiagnostic('answer-received', senderId, {
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
      });
      try {
        settingRemoteAnswerRef.current[senderId] = true;
        await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
        await flushPendingIceCandidates(pc, senderId);
      } catch (err) {
        console.error(`[WebRTC] Error setting remote answer for user ${senderId}:`, err);
      } finally {
        settingRemoteAnswerRef.current[senderId] = false;
      }
    } else {
      console.warn(`[WebRTC] RTCPeerConnection not found when handling answer from user: ${senderId}`);
    }
  }, [flushPendingIceCandidates, logVideoDiagnostic]);

  const handleIceCandidate = useCallback(async (senderId, candidateData) => {
    if (ignoreOfferRef.current[senderId]) {
      logVideoDiagnostic('ice-candidate-ignored-for-colliding-offer', senderId);
      return;
    }
    const pc = peerConnectionsRef.current[senderId];
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      // Remote description is set — safe to add the candidate immediately
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
        console.log(`[WebRTC] Added ICE candidate from user ${senderId}`);
      } catch (err) {
        console.error(`[WebRTC] Error adding ICE candidate for user ${senderId}:`, err);
      }
    } else {
      // Buffer the candidate — either the peer connection doesn't exist yet,
      // or setRemoteDescription() hasn't completed
      console.log(`[WebRTC] Buffering ICE candidate from user ${senderId}`);
      if (!pendingCandidatesRef.current[senderId]) {
        pendingCandidatesRef.current[senderId] = [];
      }
      pendingCandidatesRef.current[senderId].push(candidateData);
    }
  }, [logVideoDiagnostic]);

  const handleIncomingSignal = useCallback(async (signal) => {
    const { sender_id, signal_type, signal_data } = signal;
    console.log(`[WebRTC] Received incoming signal type ${signal_type} from sender ${sender_id}`);

    if (signal_type === 'offer') {
      await handleOffer(sender_id, signal_data);
    } else if (signal_type === 'answer') {
      await handleAnswer(sender_id, signal_data);
    } else if (signal_type === 'ice-candidate') {
      await handleIceCandidate(sender_id, signal_data);
    } else if (signal_type === 'camera-state') {
      const enabled = Boolean(signal_data?.enabled);
      const updatedAt = Number(signal_data?.updatedAt) || 0;
      const previousUpdatedAt = remoteCameraStateTimesRef.current[sender_id] || 0;
      logVideoDiagnostic('camera-state-received', sender_id, {
        enabled,
        updatedAt,
        previousUpdatedAt,
      });
      if (updatedAt >= previousUpdatedAt) {
        remoteCameraStateTimesRef.current[sender_id] = updatedAt;
        setRemoteCameraStates((prev) => ({
          ...prev,
          [sender_id]: enabled,
        }));
        logVideoDiagnostic('camera-state-applied', sender_id, { enabled, updatedAt });
      } else {
        logVideoDiagnostic('camera-state-stale-ignored', sender_id, { enabled, updatedAt });
      }
    } else if (signal_type === 'screen-share-state') {
      const enabled = Boolean(signal_data?.enabled);
      const updatedAt = Number(signal_data?.updatedAt) || 0;
      const previousUpdatedAt = remoteScreenShareStateTimesRef.current[sender_id] || 0;
      logVideoDiagnostic('screen-share-state-received', sender_id, {
        enabled,
        updatedAt,
        previousUpdatedAt,
      });
      if (updatedAt >= previousUpdatedAt) {
        remoteScreenShareStateTimesRef.current[sender_id] = updatedAt;
        setRemoteScreenShareStates((prev) => ({
          ...prev,
          [sender_id]: enabled,
        }));
      }
    }
  }, [handleOffer, handleAnswer, handleIceCandidate, logVideoDiagnostic]);

  const broadcastCameraState = useCallback(async (enabled) => {
    const remoteUserIds = participantsRef.current
      .map((participant) => participant.user_id)
      .filter((participantUserId) => participantUserId !== currentUserIdRef.current);

    const updatedAt = cameraStateUpdatedAtRef.current;
    await Promise.all(remoteUserIds.map((remoteUserId) => {
      logVideoDiagnostic('camera-state-sending', remoteUserId, { enabled, updatedAt });
      return sendSignal(remoteUserId, 'camera-state', { enabled, updatedAt });
    }));
  }, [sendSignal, logVideoDiagnostic]);

  const broadcastScreenShareState = useCallback(async (enabled) => {
    const remoteUserIds = participantsRef.current
      .map((participant) => participant.user_id)
      .filter((participantUserId) => participantUserId !== currentUserIdRef.current);

    const updatedAt = screenShareStateUpdatedAtRef.current;
    await Promise.all(remoteUserIds.map((remoteUserId) => {
      logVideoDiagnostic('screen-share-state-sending', remoteUserId, { enabled, updatedAt });
      return sendSignal(remoteUserId, 'screen-share-state', { enabled, updatedAt });
    }));
  }, [sendSignal, logVideoDiagnostic]);

  const handleStopScreenShare = useCallback(async ({ notifyPeers = true } = {}) => {
    if (screenShareStoppingRef.current) return;
    screenShareStoppingRef.current = true;

    const screenStream = screenStreamRef.current;
    const screenTrack = screenTrackRef.current;
    const screenAudioTrack = screenAudioTrackRef.current;
    const cameraTrack = cameraEnabledRef.current
      && cameraTrackRef.current?.readyState === 'live'
      ? cameraTrackRef.current
      : null;

    screenTrackRef.current = null;
    screenAudioTrackRef.current = null;
    screenStreamRef.current = null;
    screenShareStateUpdatedAtRef.current = Date.now();
    if (screenTrack) {
      screenTrack.onended = null;
    }

    try {
      const replacements = await Promise.allSettled(
        Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
          const cachedSender = videoSendersRef.current[otherUserId];
          const transceiver = pc.getTransceivers()
            .find((t) => (
              t.sender === cachedSender
              || t.sender.track?.kind === 'video'
              || t.receiver.track?.kind === 'video'
            ));
          let sender = transceiver?.sender;

          if (sender) {
            await sender.replaceTrack(cameraTrack);
            videoSendersRef.current[otherUserId] = sender;
          } else if (cameraTrack) {
            sender = pc.addTrack(cameraTrack, localStreamRef.current || new MediaStream([cameraTrack]));
            videoSendersRef.current[otherUserId] = sender;
          }

          const screenAudioSender = screenAudioSendersRef.current[otherUserId];
          if (screenAudioSender) {
            try { pc.removeTrack(screenAudioSender); } catch {}
            delete screenAudioSendersRef.current[otherUserId];
          }

          // Always renegotiate on screen share stop so all peers immediately transition away
          await negotiatePeer(otherUserId, 'screen-share-media-removed');
        })
      );

      if (replacements.some((result) => result.status === 'rejected')) {
        console.error('[WebRTC] One or more peers could not restore video after screen sharing:', replacements);
        setScreenShareError('Screen sharing stopped, but camera video could not be restored for every participant. Voice is still connected.');
      }
    } finally {
      screenStream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      if (screenTrack && !screenStream?.getTracks().includes(screenTrack)) {
        screenTrack.stop();
      }
      if (
        screenAudioTrack
        && !screenStream?.getTracks().includes(screenAudioTrack)
      ) {
        screenAudioTrack.stop();
      }
      screenAudioSendersRef.current = {};

      setLocalScreenStream(null);
      setIsScreenSharing(false);
      setScreenShareBusy(false);
      try {
        if (notifyPeers) {
          await broadcastScreenShareState(false);
          await broadcastCameraState(cameraEnabledRef.current);
        }
      } finally {
        screenShareStoppingRef.current = false;
      }
    }
  }, [broadcastCameraState, broadcastScreenShareState, negotiatePeer]);

  useEffect(() => {
    stopScreenShareRef.current = handleStopScreenShare;
  }, [handleStopScreenShare]);

  const handleStartScreenShare = useCallback(async ({ shareSystemAudio = false } = {}) => {
    if (!isJoinedRef.current || screenTrackRef.current || screenShareBusy || cameraBusy) return;

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareError('Screen sharing is not supported by this mobile browser or environment. You can turn on your camera to share your study workspace or notes!');
      return;
    }

    setScreenShareBusy(true);
    setScreenShareError('');

    let screenStream = null;
    try {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: Boolean(shareSystemAudio),
        });
      } catch (captureError) {
        const audioConstraintUnsupported = Boolean(shareSystemAudio) && [
          'NotSupportedError',
          'OverconstrainedError',
          'TypeError',
        ].includes(captureError?.name);
        if (!audioConstraintUnsupported) throw captureError;

        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      }
      const screenTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0] || null;
      if (!screenTrack) {
        throw new DOMException('No screen video track was returned.', 'NotFoundError');
      }

      screenStreamRef.current = screenStream;
      screenTrackRef.current = screenTrack;
      screenAudioTrackRef.current = screenAudioTrack;
      screenShareStateUpdatedAtRef.current = Date.now();
      screenTrack.onended = () => {
        stopScreenShareRef.current?.();
      };

      const replacements = await Promise.allSettled(
        Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
          const cachedSender = videoSendersRef.current[otherUserId];
          const transceiver = pc.getTransceivers()
            .find((t) => (
              t.sender === cachedSender
              || t.sender.track?.kind === 'video'
              || t.receiver.track?.kind === 'video'
            ));
          let sender = transceiver?.sender;

          if (transceiver && transceiver.direction !== 'sendrecv') {
            transceiver.direction = 'sendrecv';
          }

          if (sender) {
            await sender.replaceTrack(screenTrack);
            videoSendersRef.current[otherUserId] = sender;
          } else {
            sender = pc.addTrack(screenTrack, screenStream);
            videoSendersRef.current[otherUserId] = sender;
          }

          if (screenAudioTrack) {
            screenAudioSendersRef.current[otherUserId] = pc.addTrack(
              screenAudioTrack,
              screenStream,
            );
          }

          // Always renegotiate on screen share start so all peers immediately receive the video track
          await negotiatePeer(otherUserId, 'screen-share-media-added');
        })
      );

      if (replacements.some((result) => result.status === 'rejected')) {
        throw new Error('One or more screen-share senders could not be updated.');
      }
      if (screenTrack.readyState !== 'live') {
        throw new Error('Screen capture ended before it could start.');
      }

      setLocalScreenStream(new MediaStream([
        screenTrack,
        ...(screenAudioTrack ? [screenAudioTrack] : []),
      ]));
      setIsScreenSharing(true);
      await broadcastScreenShareState(true);
    } catch (err) {
      console.error('[WebRTC] Screen sharing could not start:', err);

      const cameraTrack = cameraEnabledRef.current
        && cameraTrackRef.current?.readyState === 'live'
        ? cameraTrackRef.current
        : null;
      await Promise.allSettled(
        Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
          let negotiationRequired = false;
          const cachedSender = videoSendersRef.current[otherUserId];
          const sender = pc.getTransceivers()
            .find((transceiver) => (
              transceiver.sender === cachedSender
              || transceiver.sender.track?.kind === 'video'
              || transceiver.receiver.track?.kind === 'video'
            ))?.sender;
          if (sender) {
            await sender.replaceTrack(cameraTrack);
          }

          const screenAudioSender = screenAudioSendersRef.current[otherUserId];
          if (screenAudioSender) {
            pc.removeTrack(screenAudioSender);
            delete screenAudioSendersRef.current[otherUserId];
            negotiationRequired = true;
          }

          if (negotiationRequired) {
            await negotiatePeer(otherUserId, 'screen-share-start-rolled-back');
          }
        })
      );

      screenStream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      screenStreamRef.current = null;
      screenTrackRef.current = null;
      screenAudioTrackRef.current = null;
      screenAudioSendersRef.current = {};
      screenShareStateUpdatedAtRef.current = Date.now();
      setLocalScreenStream(null);
      setIsScreenSharing(false);
      await broadcastScreenShareState(false);

      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        setScreenShareError('Screen sharing was cancelled or denied. Voice and camera are still connected.');
      } else {
        setScreenShareError('Screen sharing could not start. Voice and camera are still connected.');
      }
    } finally {
      setScreenShareBusy(false);
    }
  }, [broadcastScreenShareState, cameraBusy, negotiatePeer, screenShareBusy]);

  const handleTurnCameraOff = useCallback(async ({ notifyPeers = true } = {}) => {
    const track = cameraTrackRef.current;
    cameraTrackRef.current = null;
    cameraEnabledRef.current = false;
    cameraStateUpdatedAtRef.current = Date.now();

    // 1. INSTANT camera hardware deactivation & instant local UI update (0ms lag)
    if (track) {
      track.onended = null;
      localStreamRef.current?.removeTrack(track);
      track.stop();
    }

    setLocalVideoStream(null);
    setCameraEnabled(false);
    setCameraBusy(false);

    if (notifyPeers) {
      broadcastCameraState(false).catch(() => {});
    }

    // 2. Asynchronously update peer transceivers without blocking camera turn-off
    const replacements = Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
      const cachedSender = videoSendersRef.current[otherUserId];
      const sender = pc.getTransceivers()
        .find((transceiver) => (
          transceiver.sender === cachedSender
          || transceiver.sender.track?.kind === 'video'
          || transceiver.receiver.track?.kind === 'video'
        ))?.sender;
      if (!sender) return;
      try {
        await sender.replaceTrack(screenTrackRef.current || null);
        videoSendersRef.current[otherUserId] = sender;
        await negotiatePeer(otherUserId, 'camera-track-removed');
        logVideoDiagnostic('camera-track-removed', otherUserId, {
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        });
      } catch (err) {
        console.error(`[WebRTC] Failed to stop camera sender for ${otherUserId}:`, err);
      }
    });
    await Promise.allSettled(replacements);
  }, [broadcastCameraState, logVideoDiagnostic]);

  useEffect(() => {
    stopCameraRef.current = handleTurnCameraOff;
  }, [handleTurnCameraOff]);

  const handleTurnCameraOn = useCallback(async () => {
    if (!isJoinedRef.current || cameraTrackRef.current || cameraBusy || screenShareBusy) return;

    setCameraBusy(true);
    setCameraError('');
    try {
      let cameraStream = null;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 1.0 },
            frameRate: { ideal: 24, max: 30 },
          },
        });
      } catch (err1) {
        console.warn('[WebRTC] Square camera constraint rejected, falling back to basic user-facing:', err1);
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'user' },
          });
        } catch (err2) {
          console.warn('[WebRTC] User-facing camera rejected, falling back to basic video: true:', err2);
          cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }
      }
      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new DOMException('No camera video track was returned.', 'NotFoundError');
      }

      cameraTrackRef.current = videoTrack;
      cameraEnabledRef.current = true;
      cameraStateUpdatedAtRef.current = Date.now();
      localStreamRef.current?.addTrack(videoTrack);
      videoTrack.onended = () => {
        setCameraError('The camera disconnected or stopped. Audio is still connected.');
        stopCameraRef.current?.();
      };

      // 1. INSTANT local video stream preview (0ms lag)
      setLocalVideoStream(new MediaStream([videoTrack]));
      setCameraEnabled(true);
      setCameraBusy(false);

      broadcastCameraState(true).catch(() => {});

      logVideoDiagnostic('camera-started', null, {
        cameraTrackId: videoTrack.id,
        cameraTrackReadyState: videoTrack.readyState,
        peerConnectionCount: Object.keys(peerConnectionsRef.current).length,
      });

      // 2. Connect video track to existing peers
      const replacements = await Promise.allSettled(
        Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
          const outgoingVideoTrack = screenTrackRef.current || videoTrack;
          const outgoingVideoStream = screenTrackRef.current
            ? screenStreamRef.current
            : cameraStream;
          const senders = pc.getSenders();
          const cachedSender = videoSendersRef.current[otherUserId];
          const videoTransceivers = pc.getTransceivers().filter((transceiver) => (
            transceiver.sender === cachedSender
            || transceiver.sender.track?.kind === 'video'
            || transceiver.receiver.track?.kind === 'video'
          ));
          let sender = videoTransceivers[0]?.sender;
          logVideoDiagnostic('camera-peer-inspected', otherUserId, {
            cameraTrackId: videoTrack.id,
            cameraTrackReadyState: videoTrack.readyState,
            existingSenderTrackKinds: senders.map((existingSender) => existingSender.track?.kind || null),
            videoSenderCount: videoTransceivers.length,
            signalingState: pc.signalingState,
            connectionState: pc.connectionState,
            iceConnectionState: pc.iceConnectionState,
          });

          try {
            if (sender) {
              if (sender.track?.id !== outgoingVideoTrack.id) {
                await sender.replaceTrack(outgoingVideoTrack);
              }
              videoSendersRef.current[otherUserId] = sender;
              logVideoDiagnostic('camera-track-replaced', otherUserId, {
                cameraTrackId: videoTrack.id,
                renegotiationRequested: true,
              });
              await negotiatePeer(otherUserId, 'camera-track-replaced');
            } else {
              sender = pc.addTrack(outgoingVideoTrack, outgoingVideoStream);
              videoSendersRef.current[otherUserId] = sender;
              logVideoDiagnostic('camera-track-added', otherUserId, {
                cameraTrackId: videoTrack.id,
                renegotiationRequested: true,
              });
              await negotiatePeer(otherUserId, 'camera-track-added');
            }
          } catch (err) {
            console.error(`[WebRTC] Failed to send camera to ${otherUserId}:`, err);
            throw err;
          }
        })
      );
      if (replacements.some((result) => result.status === 'rejected')) {
        console.warn('One or more remote peers could not receive camera video immediately.');
      }
    } catch (err) {
      console.error('[WebRTC] Camera access or track update failed:', err);
      const failedTrack = cameraTrackRef.current;
      cameraTrackRef.current = null;
      cameraEnabledRef.current = false;
      cameraStateUpdatedAtRef.current = Date.now();
      await Promise.all(Object.entries(peerConnectionsRef.current).map(async ([otherUserId, pc]) => {
        const cachedSender = videoSendersRef.current[otherUserId];
        const sender = pc.getTransceivers()
          .find((transceiver) => (
            transceiver.sender === cachedSender
            || transceiver.sender.track?.kind === 'video'
            || transceiver.receiver.track?.kind === 'video'
          ))?.sender;
        if (!sender) return;
        try {
          await sender.replaceTrack(screenTrackRef.current || null);
        } catch (replaceErr) {
          console.error('[WebRTC] Failed to roll back a camera sender:', replaceErr);
        }
      }));
      if (failedTrack) {
        localStreamRef.current?.removeTrack(failedTrack);
        failedTrack.onended = null;
        failedTrack.stop();
      }
      setLocalVideoStream(null);
      setCameraEnabled(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Your audio call is still connected.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera was found. Your audio call is still connected.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('The camera is already in use or unavailable. Your audio call is still connected.');
      } else {
        setCameraError('Camera could not be started. Your audio call is still connected.');
      }
      await broadcastCameraState(false);
    } finally {
      setCameraBusy(false);
    }
  }, [broadcastCameraState, cameraBusy, logVideoDiagnostic, negotiatePeer, screenShareBusy]);

  const fetchParticipants = useCallback(async () => {
    if (!joinedChannelId) return;

    try {
      const res = await apiRequest(`/api/channels/${joinedChannelId}/voice?pollSignals=true`);
      const activeRemote = res?.participants || [];
      const queuedSignals = res?.signals || [];

      // Process queued signals if arrived via polling fallback
      if (queuedSignals.length > 0) {
        for (const sig of queuedSignals) {
          handleIncomingSignalRef.current(sig);
        }
      }

      setParticipants((prev) => {
        const localEntry = {
          id: `vp-${joinedChannelId}-${userId}`,
          channel_id: joinedChannelId,
          server_id: joinedServerId,
          user_id: userId,
          is_muted: isLocalMutedRef.current,
          joined_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          profiles: {
            username: profile?.username || 'You',
            full_name: profile?.full_name || 'You',
            avatar_url: profile?.avatar_url || null,
          },
        };
        const remoteOthers = activeRemote.filter((p) => String(p.user_id || p.userId) !== String(userId));
        return [localEntry, ...remoteOthers];
      });
    } catch (err) {
      console.warn('[VoiceSync] Participants fetch warning:', err);
    }
    setLoading(false);
  }, [joinedChannelId, joinedServerId, userId, isMuted, profile]);

  // ---------- join voice ----------
  const handleJoin = async (arg1, arg2, arg3) => {
    let channelId = arg1;
    let channelName = arg2;
    let serverId = arg3;

    if (typeof arg1 === 'object' && arg1 !== null) {
      channelId = arg1.channelId || arg1.id;
      channelName = arg1.channelName || arg1.name;
      serverId = arg1.serverId;
    }

    // Swapped arguments safeguard: if called as (serverId, channelId, channelName)
    if (serverId && typeof channelName === 'string' && (channelName.startsWith('c-') || channelName.startsWith('dm-') || channelName.length === 24 || channelName.includes('-'))) {
      const tempChannelId = channelName;
      channelName = typeof serverId === 'string' ? serverId : 'Study Room';
      serverId = channelId;
      channelId = tempChannelId;
    }

    if (!channelId || !userId) return;
    unlockAudioOnMobile();
    setJoining(true);
    setError('');
    setIsLocalMuted(false);
    isLocalMutedRef.current = false;

    try {
      await initLocalAudio(false);

      // Fetch TURN / STUN credentials
      try {
        console.log('[WebRTC] Fetching TURN credentials from backend...');
        const data = await apiRequest('/api/turn-credentials');
        iceServersRef.current = data;
        setTurnWarning('');
      } catch (err) {
        iceServersRef.current = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
        setTurnWarning('');
      }

      // Optimistically set active states & local participant
      setJoinedChannelId(channelId);
      setJoinedChannelName(channelName);
      setJoinedServerId(serverId);

      const localParticipant = {
        id: `vp-${channelId}-${userId}`,
        channel_id: channelId,
        server_id: serverId,
        user_id: userId,
        is_muted: false,
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        name: profile?.full_name || profile?.name || 'You',
        user_name: profile?.full_name || profile?.name || 'You',
        profiles: {
          username: profile?.username || 'You',
          full_name: profile?.full_name || profile?.name || 'You',
          name: profile?.full_name || profile?.name || 'You',
          avatar_url: profile?.avatar_url || null,
        },
      };

      setParticipants((prev) => [
        localParticipant,
        ...prev.filter((p) => String(p.user_id || p.userId) !== String(userId) && p.channel_id === channelId),
      ]);

      // Call join API
      try {
        await apiRequest(`/api/channels/${channelId}/voice`, {
          method: 'POST',
          body: JSON.stringify({
            action: 'join',
            serverId,
            isMuted: false,
            userName: profile?.full_name || profile?.name || profile?.username,
            username: profile?.username,
            avatar_url: profile?.avatar_url,
          }),
        });
      } catch (e) {
        console.warn('Voice join API warning:', e.message);
      }
    } catch (err) {
      console.error('Failed to join voice:', err);
      if (err.name !== 'NotAllowedError' && err.name !== 'PermissionDeniedError') {
        setError('Failed to join voice channel. Please verify microphone access.');
      }
      cleanupLocalAudio();
    }
    setJoining(false);
  };

  // ---------- leave voice ----------
  const handleLeave = async () => {
    if (!joinedChannelId || !userId) return;
    setError('');

    await handleStopScreenShare();
    await handleTurnCameraOff();
    cleanupLocalAudio();
    cleanupAllCalls('manual-disconnect');

    const leavingChannelId = joinedChannelId;
    const leavingServerId = joinedServerId;

    setJoinedChannelId(null);
    setJoinedChannelName(null);
    setJoinedServerId(null);
    setParticipants([]);

    try {
      await apiRequest(`/api/channels/${leavingChannelId}/voice`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'leave',
          serverId: leavingServerId,
        }),
      });
    } catch (e) {
      console.warn('Voice leave API warning:', e.message);
    }
  };

  // ---------- toggle mute ----------
  const handleToggleMute = async () => {
    if (!joinedChannelId || !userId) return;
    setError('');

    const newMuteState = !isLocalMutedRef.current;
    isLocalMutedRef.current = newMuteState;
    setIsLocalMuted(newMuteState);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuteState;
      });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, is_muted: newMuteState } : p))
    );

    try {
      await apiRequest(`/api/channels/${joinedChannelId}/voice`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'mute',
          isMuted: newMuteState,
        }),
      });
    } catch (e) {
      console.warn('Voice mute API warning:', e.message);
    }
  };

  // ---------- clean up voice session on unmount or unload ----------
  const cleanupVoiceSession = useCallback((reason) => {
    if (!reason) return;
    if (!currentChannelIdRef.current || !currentUserIdRef.current) return;

    isJoinedRef.current = false;
    const channelId = currentChannelIdRef.current;
    console.log(`[VoicePanel] Cleaning up voice session. Reason: ${reason}`);

    cleanupLocalAudio();
    cleanupAllCalls('voice-session-ended');

    try {
      apiRequest(`/api/channels/${channelId}/voice`, {
        method: 'POST',
        body: JSON.stringify({ action: 'leave' }),
      }).catch(() => {});
    } catch {}
  }, [cleanupLocalAudio, cleanupAllCalls]);

  // React to changes in joinedChannelId and isMuted to manage mic state and track activation
  useEffect(() => {
    if (joinedChannelId) {
      if (!localStreamRef.current) {
        initLocalAudio(isMuted).catch((err) => {
          console.error('Auto-initialization of local audio failed:', err);
        });
      } else {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      }
    } else {
      cleanupLocalAudio();
    }
  }, [joinedChannelId, isMuted, initLocalAudio, cleanupLocalAudio]);

  // Clean up all local audio tracks, peer connections, and database row on component unmount or tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupVoiceSession('tab-close');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupVoiceSession('unmount');
      clearPendingMediaPlayback();
    };
  }, [cleanupVoiceSession, clearPendingMediaPlayback]);

  // Load and poll participants
  useEffect(() => {
    if (!joinedChannelId) return;
    setLoading(true);
    setError('');
    fetchParticipants();

    const interval = setInterval(() => {
      fetchParticipants();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchParticipants, joinedChannelId]);

  // Heartbeat to update last_seen every 6 seconds when joined
  useEffect(() => {
    if (!joinedChannelId || !userId) return;

    const interval = setInterval(async () => {
      try {
        await apiRequest(`/api/channels/${joinedChannelId}/voice`, {
          method: 'POST',
          body: JSON.stringify({ action: 'heartbeat' }),
        });
      } catch {}
    }, 6000);

    return () => clearInterval(interval);
  }, [joinedChannelId, userId]);

  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  useEffect(() => {
    handleIncomingSignalRef.current = handleIncomingSignal;
  }, [handleIncomingSignal]);

  // ---------- WebRTC signaling & real-time presence subscription ----------
  useEffect(() => {
    if (!joinedChannelId || !userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    console.log(`[WebRTC] Subscribing to Pusher voice channels for ${joinedChannelId}`);

    const channelName = `voice-channel-${joinedChannelId}`;
    const signalChanName = `voice-signal-${userId}`;
    let chan = null;
    let sigChan = null;

    try {
      chan = pusher.subscribe(channelName);
      chan.bind('participant-joined', (participant) => {
        if (participant?.user_id && participant.user_id !== userId) {
          try {
            new Audio('/sounds/user-join.mp3').play().catch(() => {});
          } catch {}
          setParticipants((prev) => {
            const without = prev.filter((p) => p.user_id !== participant.user_id);
            return [...without, participant];
          });
        }
      });

      chan.bind('participant-left', ({ user_id, user_name }) => {
        if (user_id) {
          if (user_id !== userId) {
            try {
              new Audio('/sounds/user-leave.mp3').play().catch(() => {});
            } catch {}
            explicitlyLeftRef.current.add(user_id);
            const foundName = user_name || participantsRef.current.find((p) => String(p.user_id || p.userId) === String(user_id))?.profiles?.full_name || 'A scholar';
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('studycord_voice_user_left', {
                detail: { userId: user_id, name: foundName },
              }));
              window.dispatchEvent(new CustomEvent('studycord_toast', {
                detail: `${foundName} left the call`,
              }));
            }
          }
          setParticipants((prev) => prev.filter((p) => String(p.user_id || p.userId) !== String(user_id)));
          cleanupPeerConnection(user_id);
        }
      });

      chan.bind('participant-updated', ({ user_id, is_muted }) => {
        if (user_id) {
          setParticipants((prev) =>
            prev.map((p) => (p.user_id === user_id ? { ...p, is_muted } : p))
          );
        }
      });

      chan.bind('hand-raise-updated', ({ user_id, user_name, raised }) => {
        if (user_id && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studycord_hand_raise_updated', {
            detail: { userId: user_id, name: user_name, raised: Boolean(raised) },
          }));
        }
      });

      chan.bind('state-change', (signal) => {
        if (signal?.sender_id && signal.sender_id !== userId) {
          handleIncomingSignalRef.current(signal);
        }
      });
    } catch (e) {
      console.warn('Pusher room subscription error:', e);
    }

    try {
      sigChan = pusher.subscribe(signalChanName);
      sigChan.bind('signal', (signal) => {
        if (signal?.sender_id && signal.sender_id !== userId) {
          handleIncomingSignalRef.current(signal);
        }
      });
    } catch (e) {
      console.warn('Pusher signal subscription error:', e);
    }

    return () => {
      try {
        if (chan) pusher.unsubscribe(channelName);
        if (sigChan) pusher.unsubscribe(signalChanName);
      } catch {}
    };
  }, [joinedChannelId, userId, cleanupPeerConnection]);

  // ---------- WebRTC Call initialization & tracking ----------
  useEffect(() => {
    if (!joinedChannelId || !micConnected) {
      cleanupAllCalls('no-channel-or-mic-disconnected');
      return;
    }

    const startConnections = async () => {
      const remoteParticipants = participants.filter((p) => p.user_id !== userId);
      console.log(`[WebRTC] Evaluating connections for ${remoteParticipants.length} remote participant(s)`);

      for (const p of remoteParticipants) {
        const otherUserId = p.user_id;

        // Skip if connection already exists and is in a non-terminal state.
        // 'disconnected' is handled by the reconnect timer inside oniceconnectionstatechange,
        // so we do NOT tear it down here.
        const existingPc = peerConnectionsRef.current[otherUserId];
        if (existingPc) {
          const connState = existingPc.connectionState;
          const iceState = existingPc.iceConnectionState;

          // If a reconnect timer is already scheduled for this user, let the timer handle it
          if (reconnectTimeoutsRef.current[otherUserId]) {
            console.log(`[WebRTC] failed peer detected but reconnect timer already scheduled for ${otherUserId} — skipping immediate recreate`);
            continue;
          }

          // If the peer is failed but reconnecting flag is set, let reconnectPeer handle it
          if (reconnectingRef.current[otherUserId]) {
            console.log(`[WebRTC] Peer ${otherUserId} is being reconnected — skipping immediate recreate`);
            continue;
          }

          // 'disconnected' is NOT terminal — browser may recover on its own
          if (connState === 'disconnected') {
            continue;
          }

          // Only 'closed' is immediately terminal.
          // 'failed' should be handled by the reconnect timer triggered from onconnectionstatechange.
          if (connState === 'failed') {
            console.log(`[WebRTC] Peer ${otherUserId} is failed with no reconnect timer — reconnect timer is responsible for cleanup, scheduling now`);
            triggerReconnect(otherUserId);
            continue;
          }

          if (connState !== 'closed') {
            // Connection is alive or connecting — leave it alone
            continue;
          }

          console.log(`[WebRTC] Existing connection to ${otherUserId} is closed (conn=${connState}, ice=${iceState}), re-establishing`);
          cleanupPeerConnection(otherUserId);
        }

        // Deterministic offer rule: smaller userId sends offer, with 1.5s initiator fallback timer to prevent deadlock
        if (userId < otherUserId) {
          console.log(`[WebRTC] Sending offer to ${otherUserId} (we are initiator)`);
          createPeerConnection(otherUserId);
          try {
            await negotiatePeer(otherUserId, 'initial-connection');
          } catch (err) {
            console.error(`[WebRTC] Error creating/sending offer to ${otherUserId}:`, err);
          }
        } else {
          console.log(`[WebRTC] Waiting for offer from ${otherUserId} (they are initiator)`);
          if (!offerWaitTimersRef.current[otherUserId]) {
            offerWaitTimersRef.current[otherUserId] = setTimeout(async () => {
              delete offerWaitTimersRef.current[otherUserId];
              const curPc = peerConnectionsRef.current[otherUserId];
              if (!curPc || (curPc.connectionState !== 'connected' && curPc.connectionState !== 'connecting')) {
                console.log(`[WebRTC] Initiator fallback triggered for user ${otherUserId}`);
                const activePc = curPc || createPeerConnection(otherUserId);
                try {
                  await negotiatePeer(otherUserId, 'initiator-fallback');
                } catch (err) {
                  console.error(`[WebRTC] Error in initiator fallback for ${otherUserId}:`, err);
                }
              }
            }, 1500);
          }
        }
      }
    };

    startConnections();

    const currentParticipantIds = new Set(participants.map((p) => p.user_id));
    const now = Date.now();

    Object.keys(peerConnectionsRef.current).forEach((otherUserId) => {
      // 1. Explicitly left via DELETE event
      if (explicitlyLeftRef.current.has(otherUserId)) {
        console.log(`[WebRTC] User ${otherUserId} explicitly left. Closing connection.`);
        cleanupPeerConnection(otherUserId);
        return;
      }

      const participant = participants.find((p) => p.user_id === otherUserId);
      if (!participant) {
        // User is absent from the current participants list
        if (!lastAbsentRef.current[otherUserId]) {
          lastAbsentRef.current[otherUserId] = now;
          console.log(`[WebRTC] User ${otherUserId} is missing from participant list, starting grace period.`);
        } else {
          const absentDuration = now - lastAbsentRef.current[otherUserId];
          if (absentDuration > 10000) {
            console.log(`[WebRTC] User ${otherUserId} absent for ${absentDuration}ms (>10s). Closing connection.`);
            cleanupPeerConnection(otherUserId);
          }
        }
      } else {
        // User is present in the list - clear absent timer
        delete lastAbsentRef.current[otherUserId];

        // 2. Check if their last_seen is stale (> 20 seconds)
        if (participant.last_seen) {
          const lastSeenTime = new Date(participant.last_seen).getTime();
          if (now - lastSeenTime > 20000) {
            console.log(`[WebRTC] User ${otherUserId} is stale (last_seen > 20s ago). Closing connection.`);
            cleanupPeerConnection(otherUserId);
          }
        }
      }
    });
  }, [participants, joinedChannelId, micConnected, userId, createPeerConnection, negotiatePeer, cleanupPeerConnection, cleanupAllCalls]);

  // Convenient aliases for UI toggle buttons across desktop and mobile
  const toggleMic = handleToggleMute;

  const toggleCamera = useCallback(async () => {
    if (cameraEnabledRef.current || cameraTrackRef.current) {
      await handleTurnCameraOff();
    } else {
      await handleTurnCameraOn();
    }
  }, [handleTurnCameraOn, handleTurnCameraOff]);

  const toggleScreenShare = useCallback(async (opts) => {
    if (screenTrackRef.current) {
      await handleStopScreenShare();
    } else {
      await handleStartScreenShare(opts);
    }
  }, [handleStartScreenShare, handleStopScreenShare]);

  return {
    joinedChannelId,
    joinedChannelName,
    joinedServerId,
    participants,
    loading,
    joining,
    error,
    setError,
    micConnected,
    callStatus,
    isJoined,
    isMuted,
    handleJoin,
    handleLeave,
    handleToggleMute,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    connectionStatuses,
    turnWarning,
    cameraEnabled,
    cameraBusy,
    cameraError,
    setCameraError,
    isScreenSharing,
    screenShareBusy,
    screenShareError,
    setScreenShareError,
    autoplayWarning,
    playRemoteMedia,
    forgetRemoteMediaElement,
    localVideoStream,
    localScreenStream,
    remoteStreams,
    remoteCameraStates,
    remoteScreenShareStates,
    handleTurnCameraOn,
    handleTurnCameraOff,
    handleStartScreenShare,
    handleStopScreenShare,
  };
}
