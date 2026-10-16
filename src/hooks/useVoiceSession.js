import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { apiRequest } from '../lib/api';
import { getPusherClient } from '../lib/pusherClient';

const AUTOPLAY_WARNING = 'Your browser blocked automatic media playback. Click the page, then try again.';
const PLAYBACK_RETRY_EVENTS = ['pointerdown', 'click', 'keydown', 'touchstart'];

export const unlockAudioDesktopAndMobile = () => {
  if (typeof window === 'undefined') return;
  try {
    // 1. LiveKit active room audio unlocking for iOS Safari / Mobile PWA
    if (window.__livekit_active_room) {
      window.__livekit_active_room.startAudio().catch(() => {});
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      if (!window.__studycord_audio_ctx) {
        window.__studycord_audio_ctx = new AudioCtx();
      }
      if (window.__studycord_audio_ctx.state === 'suspended') {
        window.__studycord_audio_ctx.resume().catch(() => {});
      }
      try {
        const buffer = window.__studycord_audio_ctx.createBuffer(1, 1, 22050);
        const source = window.__studycord_audio_ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(window.__studycord_audio_ctx.destination);
        source.start(0);
      } catch {}
    }

    // Play all mounted audio elements in the document
    const allAudios = document.querySelectorAll('audio');
    allAudios.forEach((el) => {
      if (el) {
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(() => {});
      }
    });
  } catch {}
};

const unlockAudioOnMobile = unlockAudioDesktopAndMobile;
if (typeof window !== 'undefined') {
  window.__unlockStudyCordAudio = unlockAudioDesktopAndMobile;
  ['click', 'pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, unlockAudioDesktopAndMobile, { once: false, passive: true });
  });
}

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
  const remoteScreenShareStatesRef = useRef({});

  // Active Speaker & Audio Level Detection Engine (Web Audio API)
  const [activeSpeakerIds, setActiveSpeakerIds] = useState(new Set());
  const [audioLevels, setAudioLevels] = useState({});
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map());

  const attachAudioAnalyser = useCallback((streamUserId, stream) => {
    if (typeof window === 'undefined' || !stream || !streamUserId) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const normId = String(streamUserId);
      if (analysersRef.current.has(normId)) {
        try {
          const prev = analysersRef.current.get(normId);
          prev.sourceNode?.disconnect();
          prev.analyserNode?.disconnect();
        } catch {}
        analysersRef.current.delete(normId);
      }

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) return;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.4;
      sourceNode.connect(analyserNode);

      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      analysersRef.current.set(normId, {
        sourceNode,
        analyserNode,
        dataArray,
        lastSpokeAt: 0,
        stream,
      });
    } catch (err) {
      console.warn('[WebRTC] attachAudioAnalyser warning:', err.message);
    }
  }, []);

  const detachAudioAnalyser = useCallback((streamUserId) => {
    if (!streamUserId) return;
    const normId = String(streamUserId);
    if (!analysersRef.current.has(normId)) return;
    try {
      const entry = analysersRef.current.get(normId);
      entry.sourceNode?.disconnect();
      entry.analyserNode?.disconnect();
    } catch {}
    analysersRef.current.delete(normId);
  }, []);

  useEffect(() => {
    remoteScreenShareStatesRef.current = remoteScreenShareStates;
  }, [remoteScreenShareStates]);

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
  const livekitRoomRef = useRef(null);
  const isLiveKitActiveRef = useRef(false);
  const localIdentityRef = useRef(null);
  const clientConnIdRef = useRef(null);

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

  // Real-time Active Speaker Detection & Level Monitor (Web Audio API)
  useEffect(() => {
    if (!joinedChannelId) {
      setActiveSpeakerIds(new Set());
      setAudioLevels({});
      setIsSpeakingLocal(false);
      return;
    }

    const SPEECH_THRESHOLD = 14; // Out of 255 (~ -42 dB, above background noise)
    const HANGOVER_TIME_MS = 350; // Retain speech highlight during brief pauses/syllables

    const interval = setInterval(() => {
      const now = Date.now();
      const currentActive = new Set();
      const newLevels = {};
      let localSpeaking = false;

      analysersRef.current.forEach((entry, uId) => {
        try {
          const { analyserNode, dataArray, stream } = entry;
          const audioTrack = stream?.getAudioTracks()?.[0];
          if (!audioTrack || audioTrack.readyState !== 'live' || !audioTrack.enabled || audioTrack.muted) {
            newLevels[uId] = 0;
            return;
          }

          if (String(uId) === String(currentUserIdRef.current) && isLocalMutedRef.current) {
            newLevels[uId] = 0;
            return;
          }

          analyserNode.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          newLevels[uId] = level;

          if (avg > SPEECH_THRESHOLD) {
            entry.lastSpokeAt = now;
            currentActive.add(String(uId));
            if (String(uId) === String(currentUserIdRef.current)) localSpeaking = true;
          } else if (now - entry.lastSpokeAt < HANGOVER_TIME_MS) {
            currentActive.add(String(uId));
            if (String(uId) === String(currentUserIdRef.current)) localSpeaking = true;
          }
        } catch {}
      });

      setActiveSpeakerIds(currentActive);
      setAudioLevels(newLevels);
      setIsSpeakingLocal(localSpeaking);
    }, 60);

    return () => clearInterval(interval);
  }, [joinedChannelId]);

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
    detachAudioAnalyser(currentUserIdRef.current);
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
  }, [detachAudioAnalyser]);

  const initLocalAudio = useCallback(async (currentMuteState) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      detachAudioAnalyser(currentUserIdRef.current);
      setMicConnected(false);
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        },
      });
      localStreamRef.current = stream;
      setMicConnected(true);

      if (currentUserIdRef.current) {
        attachAudioAnalyser(currentUserIdRef.current, stream);
      }

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
  }, [attachAudioAnalyser, detachAudioAnalyser]);

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
    detachAudioAnalyser(otherUserId);

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
  }, [forgetRemoteMediaElement, updateCallStatus, detachAudioAnalyser]);

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

    analysersRef.current.forEach((entry) => {
      try {
        entry.sourceNode?.disconnect();
        entry.analyserNode?.disconnect();
      } catch {}
    });
    analysersRef.current.clear();

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

    const localAudioTracks = localStreamRef.current ? localStreamRef.current.getAudioTracks() : [];
    if (localAudioTracks.length > 0) {
      console.log(`[WebRTC] Adding local audio tracks to peer connection for ${otherUserId}`);
      localAudioTracks.forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log(`[WebRTC] No local audio track available for ${otherUserId}, creating recvonly audio transceiver`);
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch (err) {
        console.warn('[WebRTC] addTransceiver audio error:', err);
      }
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
          audioElement.volume = 1.0;
          audioElement.setAttribute('playsinline', 'true');
          audioElement.setAttribute('webkit-playsinline', 'true');
          audioElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
          document.body.appendChild(audioElement);
        }
        // Provide dedicated pure audio-only stream to guarantee reliable playback and analysis
        const audioOnlyStream = new MediaStream([event.track]);
        audioElement.srcObject = audioOnlyStream;
        audioElement.volume = 1.0;
        audioElement.muted = false;
        playRemoteMedia(audioElement);
        unlockAudioDesktopAndMobile();
        attachAudioAnalyser(otherUserId, audioOnlyStream);
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
  }, [sendSignal, cleanupPeerConnection, updateCallStatus, negotiatePeer, logVideoDiagnostic, playRemoteMedia, attachAudioAnalyser]);

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
    if (livekitRoomRef.current) {
      try {
        await livekitRoomRef.current.localParticipant.setScreenShareEnabled(false);
      } catch (e) {
        console.warn('[LiveKit] Stop screen share notice:', e);
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          track.onended = null;
          track.stop();
        });
        screenStreamRef.current = null;
      }
      screenTrackRef.current = null;
      setLocalScreenStream(null);
      setIsScreenSharing(false);
      setScreenShareBusy(false);
      screenShareStoppingRef.current = false;
      return;
    }

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

    if (livekitRoomRef.current) {
      setScreenShareBusy(true);
      setScreenShareError('');
      try {
        await livekitRoomRef.current.localParticipant.setScreenShareEnabled(true, {
          audio: Boolean(shareSystemAudio),
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        });
        const screenPub = livekitRoomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (screenPub?.track?.mediaStreamTrack) {
          const screenStream = new MediaStream([screenPub.track.mediaStreamTrack]);
          screenStreamRef.current = screenStream;
          setLocalScreenStream(screenStream);
          setIsScreenSharing(true);
          screenTrackRef.current = screenPub.track.mediaStreamTrack;
          screenPub.track.mediaStreamTrack.onended = () => {
            stopScreenShareRef.current?.();
          };
        }
      } catch (err) {
        console.error('[LiveKit] Screen sharing error:', err);
        if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
          setScreenShareError('Screen sharing could not start.');
        }
      } finally {
        setScreenShareBusy(false);
      }
      return;
    }

    // Enforce single-sharer rule: only one user can share screen at a time
    const activeRemoteSharer = Object.entries(remoteScreenShareStatesRef.current || {}).find(
      ([rId, s]) => (Boolean(s?.enabled) || s === true) && String(rId) !== String(userId)
    );
    if (activeRemoteSharer) {
      setScreenShareError('Another user is already sharing their screen. Only one user can share at a time.');
      return;
    }

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
    if (livekitRoomRef.current) {
      try {
        await livekitRoomRef.current.localParticipant.setCameraEnabled(false);
      } catch (e) {
        console.warn('[LiveKit] Camera off notice:', e);
      }
      cameraTrackRef.current = null;
      cameraEnabledRef.current = false;
      setLocalVideoStream(null);
      setCameraEnabled(false);
      setCameraBusy(false);
      return;
    }

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
    // Desktop camera video is removed as requested; mobile devices retain camera support
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    if (isDesktop) {
      console.info('[VoiceSession] Camera video is disabled on desktop.');
      return;
    }

    if (!isJoinedRef.current || cameraTrackRef.current || cameraBusy || screenShareBusy) return;

    if (livekitRoomRef.current) {
      setCameraBusy(true);
      setCameraError('');
      try {
        await livekitRoomRef.current.localParticipant.setCameraEnabled(true);
        const camPub = livekitRoomRef.current.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track?.mediaStreamTrack) {
          const stream = new MediaStream([camPub.track.mediaStreamTrack]);
          setLocalVideoStream(stream);
          cameraTrackRef.current = camPub.track.mediaStreamTrack;
        }
        cameraEnabledRef.current = true;
        setCameraEnabled(true);
      } catch (err) {
        console.warn('[LiveKit] Camera error:', err);
      } finally {
        setCameraBusy(false);
      }
      return;
    }

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
        // Build a mute-state map from previous React state (highest fidelity source)
        const prevMuteMap = new Map();
        prev.forEach((p) => {
          const id = String(p.user_id || p.userId);
          if (p.is_muted !== undefined) prevMuteMap.set(id, p.is_muted);
        });

        // When LiveKit is active, use LiveKit's authoritative real-time participant list.
        // This prevents the desktop-sees-1 / mobile-sees-2 discrepancy caused by DB
        // polling latency, and stops the speakers<->listeners flickering.
        if (livekitRoomRef.current) {
          // Override mute states with LiveKit's live isMicrophoneEnabled values
          livekitRoomRef.current.remoteParticipants.forEach((rp) => {
            const rpId = String(rp.identity);
            prevMuteMap.set(rpId, !rp.isMicrophoneEnabled);
          });

          // Build a profile enrichment map from DB results (names, avatars)
          const dbProfileMap = new Map();
          activeRemote.forEach((p) => {
            const pId = String(p.user_id || p.userId);
            dbProfileMap.set(pId, p);
          });

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

          // Build participant list from LiveKit's real-time remote participants map.
          // Use DB profile data (names/avatars) to enrich, but trust LiveKit for presence.
          const livekitRemotes = [];
          livekitRoomRef.current.remoteParticipants.forEach((rp) => {
            const pId = String(rp.identity);
            const isSelfConnection = localIdentityRef.current
              ? (pId === String(localIdentityRef.current))
              : (livekitRoomRef.current?.localParticipant && pId === String(livekitRoomRef.current.localParticipant.identity));
            if (isSelfConnection) return; // skip own connection
            const baseUserId = pId.includes('__') ? pId.split('__')[0] : pId;
            let meta = {};
            try { if (rp.metadata) meta = JSON.parse(rp.metadata); } catch {}
            const dbEntry = dbProfileMap.get(baseUserId) || dbProfileMap.get(pId);
            const isSameAccount = baseUserId === String(userId);
            const resolvedName =
              rp.name ||
              meta.name ||
              dbEntry?.profiles?.full_name ||
              dbEntry?.profiles?.username ||
              dbEntry?.name ||
              (isSameAccount ? `${profile?.full_name || 'You'} (2nd Device)` : 'Study Partner');
            const resolvedAvatar =
              meta.image ||
              dbEntry?.profiles?.avatar_url ||
              dbEntry?.avatar_url ||
              (isSameAccount ? profile?.avatar_url : null) ||
              null;
            livekitRemotes.push({
              id: `vp-${joinedChannelId}-${pId}`,
              channel_id: joinedChannelId,
              server_id: joinedServerId,
              user_id: pId,
              base_user_id: baseUserId,
              is_muted: !rp.isMicrophoneEnabled,
              joined_at: dbEntry?.joined_at || new Date().toISOString(),
              last_seen: new Date().toISOString(),
              name: resolvedName,
              user_name: resolvedName,
              profiles: {
                id: baseUserId,
                username: rp.name || meta.name || dbEntry?.profiles?.username || (isSameAccount ? `${profile?.username || 'You'} (2nd Device)` : 'Study Partner'),
                full_name: resolvedName,
                name: resolvedName,
                avatar_url: resolvedAvatar,
              },
            });
          });

          // Also include any DB participants not yet reflected in LiveKit
          // (e.g. joined just before LiveKit connection was established)
          const livekitIds = new Set(livekitRemotes.map((p) => p.user_id));
          activeRemote
            .filter((p) => {
              const pId = String(p.user_id || p.userId);
              const isSelf = localIdentityRef.current
                ? (pId === String(localIdentityRef.current))
                : (pId === String(userId));
              return !isSelf && !livekitIds.has(pId);
            })
            .forEach((p) => {
              const pId = String(p.user_id || p.userId);
              livekitRemotes.push({
                ...p,
                is_muted: prevMuteMap.has(pId) ? prevMuteMap.get(pId) : (p.is_muted ?? true),
              });
            });

          return [localEntry, ...livekitRemotes];
        }

        // WebRTC fallback path: use DB list with mute state preservation
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
        const remoteOthers = activeRemote
          .filter((p) => String(p.user_id || p.userId) !== String(userId))
          .map((p) => {
            const pId = String(p.user_id || p.userId);
            return {
              ...p,
              is_muted: prevMuteMap.has(pId) ? prevMuteMap.get(pId) : (p.is_muted ?? true),
            };
          });
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
      // 1. Attempt connection via LiveKit SFU (supports 100+ students, low latency audio & screen sharing)
      let livekitSuccess = false;
      try {
        const clientConnId = typeof window !== 'undefined'
          ? (window.__studycord_client_conn_id || (window.__studycord_client_conn_id = Math.random().toString(36).slice(2, 9)))
          : `conn_${Date.now()}`;
        clientConnIdRef.current = clientConnId;

        const tokenData = await apiRequest('/api/livekit/token', {
          method: 'POST',
          body: JSON.stringify({
            roomName: channelId,
            channelId,
            channelName,
            serverId,
            connectionId: clientConnId,
            participantName: profile?.full_name || profile?.name || profile?.username || 'Student',
            avatar: profile?.avatar_url || '',
          }),
        });

        if (tokenData?.configured && tokenData?.token && tokenData?.url) {
          localIdentityRef.current = tokenData.identity;
          console.log('[LiveKit] Connecting to LiveKit SFU room:', channelId, 'as identity:', tokenData.identity);
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true,
            },
            publishDefaults: {
              simulcast: true,
            },
          });

          if (typeof window !== 'undefined') {
            window.__livekit_active_room = room;
          }

          room.on(RoomEvent.Connected, () => {
            console.log(`[LiveKit] Connected to SFU room: ${channelId}`);
            setCallStatus('LiveKit SFU Connected (100+ Scale)');
          });

          room.on(RoomEvent.Reconnecting, () => {
            console.log('[LiveKit] Reconnecting to SFU...');
            setCallStatus('Reconnecting…');
          });

          room.on(RoomEvent.Reconnected, () => {
            console.log('[LiveKit] Reconnected to SFU');
            setCallStatus('LiveKit SFU Connected (100+ Scale)');
          });

          room.on(RoomEvent.Disconnected, (reason) => {
            console.log(`[LiveKit] Disconnected from SFU: ${reason}`);
          });

          room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            const pId = String(participant.identity);
            console.log(`[LiveKit] TrackSubscribed: kind=${track.kind}, source=${track.source}, participant=${pId}`);

            if (track.kind === Track.Kind.Audio) {
              let el = document.getElementById(`remote-audio-${pId}`);
              if (!el) {
                el = track.attach();
                el.id = `remote-audio-${pId}`;
                el.setAttribute('playsinline', 'true');
                el.setAttribute('webkit-playsinline', 'true');
                el.muted = false;
                el.volume = 1.0;
                // IMPORTANT: iOS Safari refuses to play audio elements with display:none.
                // Use position:fixed off-screen instead (same as WebRTC path).
                el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
                document.body.appendChild(el);
              } else {
                track.attach(el);
              }

              if (track.mediaStreamTrack) {
                try {
                  const tempStream = new MediaStream([track.mediaStreamTrack]);
                  attachAudioAnalyser(pId, tempStream);
                } catch {}
              }

              // Proactively attempt audio context unlock on mobile when a remote track arrives.
              // room.startAudio() is a no-op if already playing; on iOS it unlocks AudioContext
              // which is needed for audio elements to autoplay.
              room.startAudio().catch(() => {});
              unlockAudioDesktopAndMobile();
              playRemoteMedia(el);
            } else if (track.kind === Track.Kind.Video) {
              const stream = new MediaStream([track.mediaStreamTrack]);
              setRemoteStreams((prev) => ({ ...prev, [pId]: stream }));

              if (track.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShare) {
                setRemoteScreenShareStates((prev) => ({ ...prev, [pId]: true }));
              } else if (track.source === Track.Source.Camera || publication.source === Track.Source.Camera) {
                setRemoteCameraStates((prev) => ({ ...prev, [pId]: true }));
              }
            }
          });

          room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            const pId = String(participant.identity);
            console.log(`[LiveKit] TrackUnsubscribed: kind=${track.kind}, participant=${pId}`);

            if (track.kind === Track.Kind.Audio) {
              detachAudioAnalyser(pId);
              track.detach().forEach((el) => {
                forgetRemoteMediaElement(el);
                if (el && el.parentNode) el.parentNode.removeChild(el);
              });
              const existingEl = document.getElementById(`remote-audio-${pId}`);
              if (existingEl) {
                forgetRemoteMediaElement(existingEl);
                existingEl.remove();
              }
            } else if (track.kind === Track.Kind.Video) {
              setRemoteStreams((prev) => {
                const next = { ...prev };
                delete next[pId];
                return next;
              });
              if (track.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShare) {
                setRemoteScreenShareStates((prev) => ({ ...prev, [pId]: false }));
              } else {
                setRemoteCameraStates((prev) => ({ ...prev, [pId]: false }));
              }
            }
          });

          room.on(RoomEvent.TrackMuted, (publication, participant) => {
            if (publication?.kind === Track.Kind.Audio) {
              const pUserId = String(participant.identity);
              setParticipants((prev) =>
                prev.map((p) =>
                  String(p.user_id || p.userId) === pUserId ? { ...p, is_muted: true } : p
                )
              );
            }
          });

          room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
            if (publication?.kind === Track.Kind.Audio) {
              const pUserId = String(participant.identity);
              setParticipants((prev) =>
                prev.map((p) =>
                  String(p.user_id || p.userId) === pUserId ? { ...p, is_muted: false } : p
                )
              );
            }
          });

          room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const activeIds = new Set(speakers.map((s) => String(s.identity)));
            setActiveSpeakerIds(activeIds);
            const localId = localIdentityRef.current || room.localParticipant?.identity;
            const isSpeaking = (localId && activeIds.has(String(localId))) || (currentUserIdRef.current && activeIds.has(String(currentUserIdRef.current)));
            setIsSpeakingLocal(isSpeaking);

            const levels = {};
            speakers.forEach((s) => {
              const sId = String(s.identity);
              levels[sId] = Math.min(100, Math.round((s.audioLevel || 0.8) * 100));
              const baseId = sId.includes('__') ? sId.split('__')[0] : sId;
              if (baseId !== sId) {
                levels[baseId] = levels[sId];
              }
            });
            setAudioLevels((prev) => ({ ...prev, ...levels }));
          });

          // LiveKit v2 passes a plain boolean to AudioPlaybackChanged, NOT an object.
          // Destructuring { canPlayAudio } from a boolean always yields undefined.
          room.on(RoomEvent.AudioPlaybackChanged, (canPlayAudio) => {
            if (!canPlayAudio) {
              setAutoplayWarning(AUTOPLAY_WARNING);
              // Attempt immediate unlock — works if there was a recent user gesture
              room.startAudio().catch(() => {});
              unlockAudioDesktopAndMobile();
            } else {
              setAutoplayWarning('');
            }
          });

          room.on(RoomEvent.ParticipantConnected, (participant) => {
            let meta = {};
            try {
              if (participant.metadata) meta = JSON.parse(participant.metadata);
            } catch {}
            const pUserId = String(participant.identity);
            if (pUserId === localIdentityRef.current || (room.localParticipant && pUserId === room.localParticipant.identity)) return;
            const baseUserId = pUserId.includes('__') ? pUserId.split('__')[0] : pUserId;
            const isSameAccount = baseUserId === String(currentUserIdRef.current);
            const joinName = participant.name || meta.name || (isSameAccount ? `${profile?.full_name || 'You'} (2nd Device)` : 'A scholar');

            try {
              new Audio('/sounds/user-join.mp3').play().catch(() => {});
            } catch {}

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('studycord_voice_user_joined', {
                  detail: { userId: pUserId, name: joinName },
                })
              );
              window.dispatchEvent(
                new CustomEvent('studycord_toast', {
                  detail: `🟢 ${joinName} joined the space`,
                })
              );
            }

            setParticipants((prev) => {
              const without = prev.filter((p) => String(p.user_id || p.userId) !== pUserId);
              const newP = {
                id: `vp-${channelId}-${pUserId}`,
                channel_id: channelId,
                server_id: serverId,
                user_id: pUserId,
                base_user_id: baseUserId,
                is_muted: !participant.isMicrophoneEnabled,
                joined_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                name: joinName,
                user_name: joinName,
                profiles: {
                  id: baseUserId,
                  username: participant.name || meta.name || (isSameAccount ? `${profile?.username || 'You'} (2nd Device)` : 'Scholar'),
                  full_name: joinName,
                  name: joinName,
                  avatar_url: meta.image || (isSameAccount ? profile?.avatar_url : null),
                },
              };
              return [...without, newP];
            });
          });

          room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            const pUserId = String(participant.identity);
            const leaveName = participant.name || 'A scholar';

            try {
              new Audio('/sounds/user-leave.mp3').play().catch(() => {});
            } catch {}

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('studycord_voice_user_left', {
                  detail: { userId: pUserId, name: leaveName },
                })
              );
              window.dispatchEvent(
                new CustomEvent('studycord_toast', {
                  detail: `${leaveName} left the call`,
                })
              );
            }

            setParticipants((prev) => prev.filter((p) => String(p.user_id || p.userId) !== pUserId));
            detachAudioAnalyser(pUserId);
          });

          // Pre-warm microphone permission BEFORE connect so mobile browsers
          // (Safari/Chrome) have audio context unlocked via the user gesture that
          // triggered handleJoin.
          let prewarmStream = null;
          try {
            prewarmStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            console.log('[LiveKit] Microphone pre-warmed successfully');
          } catch (prewarmErr) {
            console.warn('[LiveKit] Mic pre-warm notice:', prewarmErr?.message);
          }

          await room.connect(tokenData.url, tokenData.token);

          // Unlock audio context immediately after connect (critical for iOS Safari)
          try { await room.startAudio(); } catch {}
          unlockAudioDesktopAndMobile();

          // Enable microphone on LiveKit
          try {
            await room.localParticipant.setMicrophoneEnabled(!isLocalMutedRef.current);
            setMicConnected(true);
            const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            const micTrack = micPub?.track?.mediaStreamTrack;
            if (micTrack) {
              const localAudioStream = new MediaStream([micTrack]);
              localStreamRef.current = localAudioStream;
              attachAudioAnalyser(currentUserIdRef.current, localAudioStream);
            }
          } catch (micErr) {
            console.warn('[LiveKit] Initial mic enable notice:', micErr?.message);
            try {
              await new Promise((r) => setTimeout(r, 400));
              await room.localParticipant.setMicrophoneEnabled(!isLocalMutedRef.current);
              setMicConnected(true);
            } catch (retryErr) {
              console.warn('[LiveKit] Second mic attempt notice:', retryErr?.message);
            }
          } finally {
            // Stop pre-warm stream tracks safely after LiveKit initialization
            if (prewarmStream) {
              prewarmStream.getTracks().forEach((t) => t.stop());
            }
          }

          // Listen for local mic track published (fires async on mobile after permission granted)
          room.on(RoomEvent.LocalTrackPublished, (publication) => {
            if (publication?.kind === Track.Kind.Audio) {
              const micTrack = publication?.track?.mediaStreamTrack;
              setMicConnected(true);
              if (micTrack && !localStreamRef.current) {
                const localAudioStream = new MediaStream([micTrack]);
                localStreamRef.current = localAudioStream;
                attachAudioAnalyser(currentUserIdRef.current, localAudioStream);
              }
              console.log('[LiveKit] Local mic track published (async confirm)');
            }
          });

          room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
            if (publication?.kind === Track.Kind.Audio) {
              console.warn('[LiveKit] Local mic track unpublished');
              setMicConnected(false);
            }
          });

          livekitRoomRef.current = room;
          isLiveKitActiveRef.current = true;
          livekitSuccess = true;
        }
      } catch (lkErr) {
        console.warn('[VoiceSession] LiveKit SFU connect notice:', lkErr?.message);
      }

      if (!livekitSuccess) {
        isLiveKitActiveRef.current = false;
        // Fallback to WebRTC peer-to-peer mesh
        try {
          await initLocalAudio(false);
        } catch (micErr) {
          console.warn('[WebRTC] Microphone unavailable, joining as listener:', micErr);
          setIsLocalMuted(true);
          isLocalMutedRef.current = true;
          setMicConnected(true);
        }

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
        is_muted: isLocalMutedRef.current,
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
            connectionId: clientConnIdRef.current,
            isMuted: isLocalMutedRef.current,
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

    if (livekitRoomRef.current) {
      try {
        await livekitRoomRef.current.disconnect();
      } catch (e) {
        console.warn('[LiveKit] Disconnect notice:', e);
      }
      livekitRoomRef.current = null;
      isLiveKitActiveRef.current = false;
      if (typeof window !== 'undefined') {
        delete window.__livekit_active_room;
      }
      const remoteAudios = document.querySelectorAll('audio[id^="remote-audio-"]');
      remoteAudios.forEach((el) => {
        forgetRemoteMediaElement(el);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    await handleStopScreenShare();
    await handleTurnCameraOff();
    cleanupLocalAudio();
    cleanupAllCalls('manual-disconnect');

    const leavingChannelId = joinedChannelId;
    const leavingServerId = joinedServerId;
    const leavingConnId = clientConnIdRef.current;

    setJoinedChannelId(null);
    setJoinedChannelName(null);
    setJoinedServerId(null);
    setParticipants([]);
    localIdentityRef.current = null;
    clientConnIdRef.current = null;

    try {
      await apiRequest(`/api/channels/${leavingChannelId}/voice`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'leave',
          serverId: leavingServerId,
          connectionId: leavingConnId,
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

    if (livekitRoomRef.current) {
      try {
        await livekitRoomRef.current.localParticipant.setMicrophoneEnabled(!newMuteState);
      } catch (e) {
        console.warn('[LiveKit] Toggle mute notice:', e);
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuteState;
      });
    }

    setParticipants((prev) =>
      prev.map((p) =>
        String(p.user_id || p.userId || p.profiles?.id || '') === String(userId)
          ? { ...p, is_muted: newMuteState }
          : p
      )
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

    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.disconnect();
      } catch {}
      livekitRoomRef.current = null;
      isLiveKitActiveRef.current = false;
      if (typeof window !== 'undefined') {
        delete window.__livekit_active_room;
      }
      const remoteAudios = document.querySelectorAll('audio[id^="remote-audio-"]');
      remoteAudios.forEach((el) => {
        forgetRemoteMediaElement(el);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

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
        if (!participant) return;
        const pUserId = String(participant.user_id || participant.userId || participant.profiles?.id || '');
        if (pUserId && pUserId !== String(userId)) {
          try {
            new Audio('/sounds/user-join.mp3').play().catch(() => {});
          } catch {}
          const joinName =
            participant.name ||
            participant.full_name ||
            participant.profiles?.full_name ||
            participant.profiles?.name ||
            participant.user_name ||
            participant.username ||
            participant.profiles?.username ||
            'A scholar';

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('studycord_voice_user_joined', {
                detail: { userId: pUserId, name: joinName },
              })
            );
            window.dispatchEvent(
              new CustomEvent('studycord_toast', {
                detail: `🟢 ${joinName} joined the space`,
              })
            );
          }
          setParticipants((prev) => {
            const without = prev.filter(
              (p) => String(p.user_id || p.userId || p.profiles?.id || '') !== pUserId
            );
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
          const sUid = String(user_id);
          setParticipants((prev) =>
            prev.map((p) =>
              String(p.user_id || p.userId || p.profiles?.id || '') === sUid
                ? { ...p, is_muted }
                : p
            )
          );
        }
      });

      chan.bind('hand-raise-updated', ({ user_id, user_name, raised }) => {
        if (user_id && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('studycord_hand_raise_updated', {
            detail: { userId: user_id, name: user_name, raised: Boolean(raised) },
          }));
          if (raised && String(user_id) !== String(userId)) {
            window.dispatchEvent(new CustomEvent('studycord_toast', {
              detail: `✋ ${user_name || 'A classmate'} raised hand to speak`,
            }));
          }
        }
      });

      chan.bind('promoted-to-speaker', ({ targetUserId, promotedByName }) => {
        if (String(targetUserId) === String(userId)) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('studycord_promoted_to_speaker', {
                detail: { promotedByName },
              })
            );
            window.dispatchEvent(
              new CustomEvent('studycord_toast', {
                detail: `🎙️ ${promotedByName || 'The host'} invited you to speak!`,
              })
            );
          }
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
    if (!joinedChannelId) {
      cleanupAllCalls('no-channel-joined');
      return;
    }

    const startConnections = async () => {
      if (isLiveKitActiveRef.current) {
        console.log('[WebRTC] LiveKit SFU active, bypassing peer-to-peer mesh creation.');
        return;
      }
      const remoteParticipants = participants.filter((p) => String(p.user_id || p.userId) !== String(userId));
      console.log(`[WebRTC] Evaluating connections for ${remoteParticipants.length} remote participant(s)`);

      for (const p of remoteParticipants) {
        const otherUserId = String(p.user_id || p.userId);

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
        if (String(userId) < String(otherUserId)) {
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

      const pc = peerConnectionsRef.current[otherUserId];
      // If the peer is actively connected via WebRTC, never tear it down due to HTTP polling jitter
      if (pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected')) {
        delete lastAbsentRef.current[otherUserId];
        return;
      }

      const participant = participants.find((p) => String(p.user_id || p.userId) === String(otherUserId));
      if (!participant) {
        // User is absent from the current participants list
        if (!lastAbsentRef.current[otherUserId]) {
          lastAbsentRef.current[otherUserId] = now;
        } else {
          const absentDuration = now - lastAbsentRef.current[otherUserId];
          // Grace period of 30 seconds before closing disconnected non-active peer
          if (absentDuration > 30000 && pc && pc.connectionState !== 'connected') {
            console.log(`[WebRTC] Inactive peer ${otherUserId} absent for ${absentDuration}ms. Closing connection.`);
            cleanupPeerConnection(otherUserId);
          }
        }
      } else {
        delete lastAbsentRef.current[otherUserId];
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

  const promoteToSpeaker = useCallback(async (targetUserId) => {
    if (!joinedChannelId || !targetUserId) return;
    try {
      await apiRequest(`/api/channels/${joinedChannelId}/voice`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'promote-speaker',
          targetUserId: String(targetUserId),
        }),
      });
    } catch (e) {
      console.warn('Failed to promote to speaker:', e);
    }
  }, [joinedChannelId]);

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
    promoteToSpeaker,
    unlockAudio: unlockAudioDesktopAndMobile,
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
    activeSpeakerIds,
    audioLevels,
    isSpeaking: isSpeakingLocal,
  };
}
