'use client';

import { useState } from 'react';

const COMMON_CHANNELS = [
  { name: 'general', type: 'text', label: '#general (Chat & Discussion)', defaultChecked: true },
  { name: 'study-lounge', type: 'voice', label: '🎙️ Study Lounge (Live Audio Room)', defaultChecked: true },
  { name: 'exam-prep', type: 'text', label: '#exam-prep (Practice & Quizzes)', defaultChecked: false },
  { name: 'lecture-notes', type: 'text', label: '#lecture-notes (Shared Notes & PDFs)', defaultChecked: false },
  { name: 'homework-help', type: 'text', label: '#homework-help (Peer Solutions)', defaultChecked: false },
];

export default function ChatterRoomActionModal({
  mode = 'create', // 'create' | 'join'
  isOpen,
  onClose,
  onRoomCreated,
  onRoomJoined,
}) {
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected optional channels
  const [selectedChannels, setSelectedChannels] = useState({
    general: true,
    'study-lounge': true,
    'exam-prep': false,
    'lecture-notes': false,
    'homework-help': false,
  });

  if (!isOpen) return null;

  const toggleChannel = (name) => {
    setSelectedChannels((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Server / Room
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create room');
      }

      const newServer = await res.json();
      const serverId = newServer.id;

      // 2. Optionally create additional selected channels
      const extraChannels = COMMON_CHANNELS.filter(
        (c) => selectedChannels[c.name] && c.name !== 'general' && c.name !== 'Study Room' && c.name !== 'study-lounge'
      );

      for (const ch of extraChannels) {
        try {
          await fetch(`/api/servers/${serverId}/channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: ch.name, type: ch.type }),
          });
        } catch {}
      }

      // Re-fetch enriched server if needed or pass newServer
      onRoomCreated?.(newServer);
      onClose();
    } catch (err) {
      setError(err.message || 'Error creating study room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError('Please enter a Room ID or invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/servers/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: joinCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid room code or ID');
      }

      const joinedServer = await res.json();
      onRoomJoined?.(joinedServer);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--chatter-sheet)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: 24,
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff' }}>
            {mode === 'create' ? 'Create Study Room' : 'Join Study Room'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--chatter-light-text)',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255, 57, 57, 0.15)',
              border: '1px solid rgba(255, 57, 57, 0.3)',
              color: 'var(--chatter-red)',
              fontSize: 12.5,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Organic Chemistry Study Group"
                style={{
                  width: '100%',
                  background: 'var(--chatter-black)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>

            {/* Optional Channels to Pre-create */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Optional Channels to Include
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {COMMON_CHANNELS.map((ch) => {
                  const isChecked = selectedChannels[ch.name];
                  return (
                    <label
                      key={ch.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '9px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: isChecked ? '#fff' : 'var(--chatter-light-text)',
                        border: isChecked ? '1px solid rgba(64, 227, 120, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChannel(ch.name)}
                        style={{ accentColor: 'var(--chatter-primary)', width: 16, height: 16 }}
                      />
                      <span style={{ fontWeight: 600 }}>{ch.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !roomName.trim()}
                style={{
                  padding: '10px 22px',
                  borderRadius: 20,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading || !roomName.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !roomName.trim() ? 0.6 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Enter the Room ID or the 8-character invite code shared by your classmate to join their study space immediately.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Room ID or Invite Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. CSAI2026 or 670b1a..."
                style={{
                  width: '100%',
                  background: 'var(--chatter-black)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                style={{
                  padding: '10px 22px',
                  borderRadius: 20,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading || !joinCode.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !joinCode.trim() ? 0.6 : 1,
                }}
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
