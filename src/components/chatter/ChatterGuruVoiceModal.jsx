'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Strips markdown symbols, code fences, and special formatting so speech synthesis
 * reads clear, natural spoken language without reading syntax out loud.
 */
function cleanTextForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/```[\s\S]*?```/g, 'Code example omitted.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~#>-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ChatterGuruVoiceModal({
  isOpen,
  onClose,
  aiMode = 'free',
  selectedDoc = null,
  serverId = null,
  channelName = null,
  onSaveVoiceMessages = null,
}) {
  // States: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'error'
  const [voiceState, setVoiceState] = useState('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [currentAiSpeech, setCurrentAiSpeech] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [statusMessage, setStatusMessage] = useState('Connecting to StudyGuru Voice...');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const isMutedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptBufferRef = useRef('');
  const conversationHistoryRef = useRef([]);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  // Load and cache browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const populateVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
      const activeList = englishVoices.length > 0 ? englishVoices : voices;
      setAvailableVoices(activeList);

      if (activeList.length > 0 && !selectedVoiceURI) {
        // Prefer natural, high-clarity female / male voices
        const preferred = activeList.find((v) =>
          /natural|google|samantha|karen|daniel|alex|serena|oliver/i.test(v.name)
        ) || activeList[0];
        if (preferred) {
          setSelectedVoiceURI(preferred.voiceURI);
        }
      }
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [selectedVoiceURI]);

  // Stop active AI speech
  const stopAiSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
  }, []);

  // Speak text using Web Speech API Synthesis
  const speakText = useCallback(
    (textToSpeak, onComplete) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        onComplete?.();
        return;
      }

      stopAiSpeech();
      const cleaned = cleanTextForSpeech(textToSpeak);
      if (!cleaned) {
        onComplete?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      if (selectedVoiceURI) {
        const found = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
        if (found) utterance.voice = found;
      }

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setVoiceState('speaking');
        setStatusMessage('Guru is speaking...');
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        onComplete?.();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis notice:', e?.error);
        isSpeakingRef.current = false;
        onComplete?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [availableVoices, selectedVoiceURI, stopAiSpeech]
  );

  // Send student speech to AI and process spoken response
  const submitSpokenQuestion = useCallback(
    async (spokenQuestion) => {
      const question = spokenQuestion?.trim();
      if (!question) return;

      // Stop recognition and any ongoing speech
      stopAiSpeech();
      try {
        recognitionRef.current?.stop();
      } catch {}

      setVoiceState('thinking');
      setStatusMessage('Guru is thinking...');
      setLiveTranscript('');
      setCurrentAiSpeech('');

      // Add to session turns
      const userTurn = {
        role: 'user',
        text: question,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setConversationHistory((prev) => [...prev, userTurn]);

      const docText = selectedDoc?.extractedText ? selectedDoc.extractedText.slice(0, 18000) : '';
      const docTitle = selectedDoc?.filename || null;
      const docId = selectedDoc?.doc_id || null;

      try {
        abortControllerRef.current = new AbortController();
        const res = await fetch('/api/rag/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            message: question,
            voiceMode: true,
            mode: aiMode,
            serverId,
            channelName,
            documentId: docId,
            documentTitle: docTitle,
            documentText: docText,
            history: conversationHistoryRef.current.slice(-6).map((turn) => ({
              role: turn.role,
              content: turn.text,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error('AI response error');
        }

        const data = await res.json().catch(() => ({}));
        const rawAnswer = data.answer || data.reply || data.content || "I'm ready for your next study question!";
        const cleanAnswer = cleanTextForSpeech(rawAnswer);

        setCurrentAiSpeech(rawAnswer);

        const aiTurn = {
          role: 'assistant',
          text: rawAnswer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setConversationHistory((prev) => [...prev, aiTurn]);

        // Speak the response, then seamlessly resume hands-free listening
        speakText(cleanAnswer, () => {
          if (!isMutedRef.current && recognitionRef.current) {
            setVoiceState('listening');
            setStatusMessage('Listening to you...');
            try {
              recognitionRef.current.start();
            } catch {}
          } else {
            setVoiceState('paused');
            setStatusMessage('Microphone paused');
          }
        });
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('AI Voice query failed:', err);
        setVoiceState('error');
        setErrorMessage('Could not connect to AI Guru. Tap to retry.');
        speakText("I had trouble hearing that. Could you please say that once more?", () => {
          setVoiceState('listening');
          setStatusMessage('Listening to you...');
          try {
            recognitionRef.current?.start();
          } catch {}
        });
      }
    },
    [aiMode, channelName, selectedDoc, serverId, speakText, stopAiSpeech]
  );

  // Initialize Speech Recognition & Audio Analyser
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    // Check browser SpeechRecognition support
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setVoiceState('error');
      setErrorMessage(
        'Speech Recognition is not supported in this browser. Please use Google Chrome, Edge, Safari, or mobile Chrome.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isListeningRef.current = true;
      if (!isSpeakingRef.current) {
        setVoiceState('listening');
        setStatusMessage('Listening to you...');
      }
    };

    recognition.onresult = (event) => {
      // If AI is speaking, discard audio or interrupt if user intentionally speaks
      if (isSpeakingRef.current) {
        stopAiSpeech();
      }

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const activeText = final || interim;
      if (activeText) {
        setLiveTranscript(activeText);
        transcriptBufferRef.current = activeText;

        // Clear existing silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Detect pause in user speech (1.4 seconds of silence triggers submission)
        silenceTimerRef.current = setTimeout(() => {
          if (transcriptBufferRef.current.trim().length > 1) {
            const queryToSend = transcriptBufferRef.current;
            transcriptBufferRef.current = '';
            submitSpokenQuestion(queryToSend);
          }
        }, 1400);
      }
    };

    recognition.onerror = (e) => {
      console.warn('Speech recognition notice:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setVoiceState('error');
        setErrorMessage('Microphone access was denied. Please allow microphone permissions.');
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      // Auto-restart recognition if modal is still active, not speaking, and not muted
      if (mounted && !isMutedRef.current && !isSpeakingRef.current) {
        try {
          recognition.start();
        } catch {}
      }
    };

    // Request Mic & Setup Real-time Audio Level Visualizer
    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        micStreamRef.current = stream;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVisualizer = () => {
          if (!mounted) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale to 0 - 100
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setAudioLevel(level);
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };

        updateVisualizer();

        // Start recognition and greeting
        try {
          recognition.start();
        } catch {}

        // Friendly spoken welcome greeting
        const welcomeText =
          aiMode === 'guided' && selectedDoc?.filename
            ? `Hello! I'm StudyGuru Voice, your live study tutor for ${selectedDoc.filename}. What concept would you like to explore?`
            : "Hey there! I'm StudyGuru Voice. What subject or study topic would you like to discuss today?";

        setCurrentAiSpeech(welcomeText);
        speakText(welcomeText, () => {
          setVoiceState('listening');
          setStatusMessage('Listening to you...');
        });
      } catch (micErr) {
        console.error('Microphone initialization failed:', micErr);
        setVoiceState('error');
        setErrorMessage('Microphone access is required for voice chat. Please allow mic permissions.');
      }
    };

    initAudio();

    return () => {
      mounted = false;
      stopAiSpeech();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      try {
        recognition.stop();
        recognitionRef.current = null;
      } catch {}

      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isOpen, aiMode, selectedDoc, speakText, stopAiSpeech, submitSpokenQuestion]);

  // Handle Mute Toggle
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;

    if (next) {
      stopAiSpeech();
      try {
        recognitionRef.current?.stop();
      } catch {}
      setVoiceState('paused');
      setStatusMessage('Microphone paused');
    } else {
      setVoiceState('listening');
      setStatusMessage('Listening to you...');
      try {
        recognitionRef.current?.start();
      } catch {}
    }
  };

  // Handle Interrupt: student interrupts AI
  const handleInterrupt = () => {
    stopAiSpeech();
    setVoiceState('listening');
    setStatusMessage('Listening to you...');
    try {
      recognitionRef.current?.start();
    } catch {}
  };

  // Close session and pass turns back to parent text chat
  const handleEndSession = () => {
    stopAiSpeech();
    if (conversationHistory.length > 0 && onSaveVoiceMessages) {
      const formatted = conversationHistory.map((turn, idx) => ({
        id: `voice-msg-${Date.now()}-${idx}`,
        role: turn.role,
        content: turn.text,
        timestamp: turn.timestamp || 'Voice call',
        isVoiceNote: true,
      }));
      onSaveVoiceMessages(formatted);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Visualizer scale calculations
  const dynamicScale = voiceState === 'listening' ? 1 + audioLevel * 0.005 : voiceState === 'speaking' ? 1.08 : 1.0;
  const glowOpacity = voiceState === 'listening' ? 0.35 + audioLevel * 0.008 : voiceState === 'speaking' ? 0.6 : 0.25;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(5, 5, 5, 0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(18px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px))',
        color: '#fff',
        fontFamily: 'var(--font-family)',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      {/* ── Top Header ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: 'rgba(64, 227, 120, 0.16)',
              border: '1.5px solid rgba(64, 227, 120, 0.4)',
              color: 'var(--chatter-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff' }}>
                StudyGuru Voice
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  background: 'rgba(64, 227, 120, 0.2)',
                  color: 'var(--chatter-primary)',
                  padding: '2px 8px',
                  borderRadius: 8,
                }}
              >
                LIVE
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)' }}>
              {aiMode === 'guided' && selectedDoc?.filename
                ? `Guided: ${selectedDoc.filename}`
                : '1-on-1 Interactive AI Tutor'}
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Voice selector dropdown if multiple voices available */}
          {availableVoices.length > 1 && (
            <select
              aria-label="Select AI Voice"
              value={selectedVoiceURI}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#fff',
                fontSize: 12,
                borderRadius: 14,
                padding: '6px 10px',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 140,
              }}
            >
              {availableVoices.slice(0, 12).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI} style={{ background: '#121212', color: '#fff' }}>
                  {v.name.replace(/Microsoft|Google|Apple|English/gi, '').trim().slice(0, 16) || v.name.slice(0, 16)}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleEndSession}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Close Voice Session"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Center Animated Voice Visualizer (Orb & Pulse Waves) ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 500,
          margin: '20px 0',
          position: 'relative',
        }}
      >
        {/* Glowing Outer Aura */}
        <div
          style={{
            position: 'absolute',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(64, 227, 120, 0.5) 0%, rgba(34, 197, 94, 0.1) 60%, transparent 75%)',
            transform: `scale(${dynamicScale * 1.25})`,
            opacity: glowOpacity,
            transition: 'transform 0.08s ease-out, opacity 0.15s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Pulsing Concentric Ripple Rings */}
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            border: `2px solid rgba(64, 227, 120, ${voiceState === 'listening' ? 0.3 + audioLevel * 0.006 : 0.15})`,
            transform: `scale(${dynamicScale * 1.12})`,
            transition: 'transform 0.08s ease-out',
            pointerEvents: 'none',
          }}
        />

        {/* Central Glowing Orb */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background:
              voiceState === 'thinking'
                ? 'linear-gradient(135deg, #10b981, #065f46, #40E378)'
                : voiceState === 'speaking'
                ? 'linear-gradient(135deg, #40E378, #10b981, #34d399)'
                : voiceState === 'paused'
                ? 'linear-gradient(135deg, #4b5563, #1f2937)'
                : 'linear-gradient(135deg, #22c55e, #15803d, #40E378)',
            boxShadow:
              voiceState === 'thinking'
                ? '0 0 50px rgba(64, 227, 120, 0.8), inset 0 0 25px rgba(255, 255, 255, 0.4)'
                : voiceState === 'speaking'
                ? '0 0 60px rgba(64, 227, 120, 0.9), inset 0 0 30px rgba(255, 255, 255, 0.6)'
                : '0 0 40px rgba(64, 227, 120, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${dynamicScale})`,
            transition: 'transform 0.08s ease-out, background 0.3s ease, box-shadow 0.3s ease',
            cursor: 'pointer',
          }}
          onClick={voiceState === 'speaking' ? handleInterrupt : handleToggleMute}
          title={voiceState === 'speaking' ? 'Tap to interrupt' : isMuted ? 'Tap to unmute' : 'Tap to mute'}
        >
          {voiceState === 'thinking' ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          ) : voiceState === 'speaking' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[0.4, 0.8, 1.2, 0.7, 0.5].map((delay, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: 24,
                    borderRadius: 3,
                    background: '#0E0E0E',
                    animation: `studycordWaveBar 0.9s ease-in-out infinite alternate`,
                    animationDelay: `${delay * 0.25}s`,
                  }}
                />
              ))}
            </div>
          ) : isMuted ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            </svg>
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="#0E0E0E">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#0E0E0E" strokeWidth="2" fill="none" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="#0E0E0E" strokeWidth="2.5" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="#0E0E0E" strokeWidth="2.5" />
            </svg>
          )}
        </div>

        {/* Status Pill Badge */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 16px',
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: 13.5,
            fontWeight: 700,
            color: voiceState === 'listening' ? 'var(--chatter-primary)' : voiceState === 'speaking' ? '#40E378' : '#fff',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                voiceState === 'listening'
                  ? 'var(--chatter-primary)'
                  : voiceState === 'speaking'
                  ? '#40E378'
                  : voiceState === 'thinking'
                  ? '#38bdf8'
                  : '#ef4444',
              boxShadow: `0 0 8px currentColor`,
              animation: voiceState === 'listening' || voiceState === 'speaking' ? 'pulse 1.6s infinite' : 'none',
            }}
          />
          <span>{statusMessage}</span>
        </div>
      </div>

      {/* ── Real-Time Spoken Dialogue & Captions Card ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'rgba(20, 20, 20, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 22,
          padding: '16px 20px',
          minHeight: 100,
          maxHeight: 160,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          scrollbarWidth: 'none',
        }}
      >
        {liveTranscript && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#aaa', minWidth: 42 }}>You:</span>
            <span style={{ fontSize: 15, color: '#fff', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.4 }}>
              "{liveTranscript}"
            </span>
          </div>
        )}

        {currentAiSpeech && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--chatter-primary)', minWidth: 42 }}>Guru:</span>
            <span style={{ fontSize: 14.5, color: '#e5e7eb', lineHeight: 1.4 }}>
              {currentAiSpeech}
            </span>
          </div>
        )}

        {!liveTranscript && !currentAiSpeech && (
          <div style={{ textAlign: 'center', color: 'var(--chatter-light-text)', fontSize: 13.5, margin: 'auto 0' }}>
            Speak naturally to AI Guru. Your words will be transcribed in real time.
          </div>
        )}
      </div>

      {/* ── Bottom Controls Bar ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          paddingTop: 16,
        }}
      >
        {/* Mic Mute / Unmute Button */}
        <button
          type="button"
          onClick={handleToggleMute}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: 20,
            background: isMuted ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255, 255, 255, 0.08)',
            border: isMuted ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
            color: isMuted ? '#ef4444' : '#fff',
            fontSize: 14.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          {isMuted ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              </svg>
              <span>Unmute Mic</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2.5" />
                <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2.5" />
              </svg>
              <span>Mute Mic</span>
            </>
          )}
        </button>

        {/* Interrupt Button (When Guru is speaking) */}
        {voiceState === 'speaking' && (
          <button
            type="button"
            onClick={handleInterrupt}
            style={{
              padding: '12px 18px',
              borderRadius: 20,
              background: 'rgba(64, 227, 120, 0.16)',
              border: '1.5px solid var(--chatter-primary)',
              color: 'var(--chatter-primary)',
              fontSize: 14.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>✋</span>
            <span>Interrupt</span>
          </button>
        )}

        {/* End Voice Session Button */}
        <button
          type="button"
          onClick={handleEndSession}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: 20,
            background: '#ef4444',
            border: 'none',
            color: '#fff',
            fontSize: 14.5,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.35)',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18L18 6M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span>End Voice Chat</span>
        </button>
      </div>
    </div>
  );
}
