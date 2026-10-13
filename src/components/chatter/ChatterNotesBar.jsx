'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatterNotesBar({
  user,
  profile,
  onOpenLiveSpaces,
}) {
  const [userNote, setUserNote] = useState(null);
  const [notes, setNotes] = useState([
    {
      id: 'note-1',
      author: {
        id: 'u-elena',
        name: 'Elena Rostova',
        username: 'elena_cs',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Graph Theory & BFS drill 🌲',
      emoji: '🌲',
      timestamp: '25m ago',
    },
    {
      id: 'note-2',
      author: {
        id: 'u-kenji',
        name: 'Kenji Sato',
        username: 'kenji_bio',
        avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
      },
      text: 'MCAT biochem amino acids 🧬',
      emoji: '🧬',
      timestamp: '1h ago',
    },
    {
      id: 'note-3',
      author: {
        id: 'u-sarah',
        name: 'Sarah Connor',
        username: 'sarah_premed',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Pomodoro round 3: Focus ⏳',
      emoji: '⏳',
      timestamp: '2h ago',
    },
    {
      id: 'note-4',
      author: {
        id: 'u-david',
        name: 'David Kim',
        username: 'david_algo',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Linear Algebra eigenbasis 📐',
      emoji: '📐',
      timestamp: '3h ago',
    },
    {
      id: 'note-5',
      author: {
        id: 'u-mia',
        name: 'Mia Chen',
        username: 'mia_design',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Working on OS kernel labs 💻',
      emoji: '💻',
      timestamp: '4h ago',
    },
  ]);

  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [createNoteModalOpen, setCreateNoteModalOpen] = useState(false);
  const [noteInputText, setNoteInputText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [savingNote, setSavingNote] = useState(false);

  // Load user's saved status note on mount
  useEffect(() => {
    fetch('/api/user/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.status?.text) {
          setUserNote({
            id: 'my-note',
            text: data.status.text,
            emoji: data.status.emoji || '📚',
            timestamp: 'Today',
          });
        }
      })
      .catch(() => {});
  }, []);

  // Story Viewer Timer (auto-advance every 4 seconds)
  useEffect(() => {
    if (activeStoryIndex === null) {
      setStoryProgress(0);
      return;
    }

    const allStories = userNote
      ? [
          {
            id: 'my-note',
            author: {
              id: user?.id || 'me',
              name: profile?.name || 'You',
              username: profile?.username || 'scholar',
              avatar_url: profile?.avatar_url,
            },
            text: userNote.text,
            emoji: userNote.emoji,
            timestamp: userNote.timestamp,
          },
          ...notes,
        ]
      : notes;

    const DURATION_MS = 4000;
    const INTERVAL_MS = 40;
    const step = 100 / (DURATION_MS / INTERVAL_MS);

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          if (activeStoryIndex < allStories.length - 1) {
            setActiveStoryIndex((idx) => idx + 1);
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + step;
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [activeStoryIndex, userNote, notes, user, profile]);

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteInputText.trim()) return;

    setSavingNote(true);
    const newNoteObj = {
      id: 'my-note',
      text: noteInputText.trim(),
      emoji: selectedEmoji,
      timestamp: 'Just now',
    };

    try {
      await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newNoteObj.text,
          emoji: newNoteObj.emoji,
          state: 'online',
        }),
      });
      setUserNote(newNoteObj);
      setNoteInputText('');
      setCreateNoteModalOpen(false);
    } catch (err) {
      console.warn('Note save fallback:', err);
      setUserNote(newNoteObj);
      setCreateNoteModalOpen(false);
    } finally {
      setSavingNote(false);
    }
  };

  const allStoryItems = userNote
    ? [
        {
          id: 'my-note',
          author: {
            id: user?.id || 'me',
            name: profile?.name || 'You',
            username: profile?.username || 'scholar',
            avatar_url: profile?.avatar_url,
          },
          text: userNote.text,
          emoji: userNote.emoji,
          timestamp: userNote.timestamp,
        },
        ...notes,
      ]
    : notes;

  return (
    <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
      <div
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '6px 4px',
          alignItems: 'flex-start',
        }}
      >
        {/* ── 1. User Note Item (+) ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            width: 72,
          }}
        >
          {/* Note Bubble */}
          <div
            onClick={() => {
              if (userNote) {
                setActiveStoryIndex(0);
              } else {
                setCreateNoteModalOpen(true);
              }
            }}
            style={{
              background: 'var(--chatter-sheet)',
              border: userNote ? '1px solid var(--chatter-primary)' : '1px dashed rgba(255, 255, 255, 0.18)',
              borderRadius: 14,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: userNote ? '#fff' : 'var(--chatter-light-text)',
              maxWidth: 72,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            title={userNote ? userNote.text : 'Share a note'}
          >
            {userNote ? `${userNote.emoji} ${userNote.text}` : 'Share note'}
          </div>

          {/* Avatar with (+) badge */}
          <div
            onClick={() => setCreateNoteModalOpen(true)}
            style={{ position: 'relative', width: 54, height: 54 }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your Avatar"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: userNote ? '2px solid var(--chatter-primary)' : '2px solid rgba(255, 255, 255, 0.12)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: '#242424',
                  color: 'var(--chatter-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 20,
                  border: userNote ? '2px solid var(--chatter-primary)' : '2px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {profile?.name?.[0]?.toUpperCase() || 'Y'}
              </div>
            )}

            {/* Plus Icon Badge */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--chatter-primary)',
                color: '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 900,
                border: '2px solid var(--chatter-black)',
              }}
            >
              +
            </div>
          </div>

          <span
            style={{
              fontSize: 11,
              color: 'var(--chatter-light-text)',
              marginTop: 4,
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            Your Note
          </span>
        </div>

        {/* ── 2. Classmate Notes ── */}
        {notes.map((note, index) => {
          const storyIndex = userNote ? index + 1 : index;
          return (
            <div
              key={note.id}
              onClick={() => {
                setActiveStoryIndex(storyIndex);
                setStoryProgress(0);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                width: 72,
              }}
            >
              {/* Note Thought Bubble */}
              <div
                style={{
                  background: 'var(--chatter-sheet)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 14,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  maxWidth: 72,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
                title={note.text}
              >
                {note.emoji} {note.text}
              </div>

              {/* Avatar with Stories Ring */}
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  padding: 2,
                  background: 'linear-gradient(45deg, var(--chatter-primary), #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={note.author.avatar_url}
                  alt={note.author.name}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--chatter-black)',
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: 11,
                  color: '#fff',
                  marginTop: 4,
                  textAlign: 'center',
                  fontWeight: 600,
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {note.author.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── 3. Story Viewer Modal (Auto-advancing progress bar) ── */}
      {activeStoryIndex !== null && allStoryItems[activeStoryIndex] && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Top Story Progress Bars */}
          <div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
              {allStoryItems.map((st, i) => {
                let fillPercent = 0;
                if (i < activeStoryIndex) fillPercent = 100;
                else if (i === activeStoryIndex) fillPercent = storyProgress;
                return (
                  <div
                    key={st.id}
                    style={{
                      flex: 1,
                      height: 3,
                      background: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${fillPercent}%`,
                        background: 'var(--chatter-primary)',
                        transition: i === activeStoryIndex ? 'width 0.04s linear' : 'none',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Author Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={allStoryItems[activeStoryIndex].author.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                  alt="Story Author"
                  style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {allStoryItems[activeStoryIndex].author.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                    @{allStoryItems[activeStoryIndex].author.username} · {allStoryItems[activeStoryIndex].timestamp}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStoryIndex(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Central Story Note Card */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 10px',
              position: 'relative',
            }}
          >
            {/* Left Tap Zone (Previous Story) */}
            <div
              onClick={() => {
                if (activeStoryIndex > 0) {
                  setActiveStoryIndex((i) => i - 1);
                  setStoryProgress(0);
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '35%',
                cursor: 'pointer',
              }}
            />

            {/* Right Tap Zone (Next Story) */}
            <div
              onClick={() => {
                if (activeStoryIndex < allStoryItems.length - 1) {
                  setActiveStoryIndex((i) => i + 1);
                  setStoryProgress(0);
                } else {
                  setActiveStoryIndex(null);
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '35%',
                cursor: 'pointer',
              }}
            />

            <div
              style={{
                background: 'var(--chatter-sheet)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 24,
                padding: '36px 28px',
                maxWidth: 420,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                zIndex: 2,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {allStoryItems[activeStoryIndex].emoji || '📚'}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                &ldquo;{allStoryItems[activeStoryIndex].text}&rdquo;
              </h3>
              <p style={{ fontSize: 13, color: 'var(--chatter-light-text)', margin: 0 }}>
                Study Status on StudyCord
              </p>
            </div>
          </div>

          {/* Bottom Tap Navigation Info */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--chatter-light-text)' }}>
            Tap left to go back · Tap right to skip · Auto-advancing
          </div>
        </div>
      )}

      {/* ── 4. Create / Update Note Modal ── */}
      {createNoteModalOpen && (
        <div
          onClick={() => setCreateNoteModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--chatter-sheet)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 400,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
                Share a Study Note
              </h3>
              <button
                type="button"
                onClick={() => setCreateNoteModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
              Your note will appear in the study status tray above the feed for classmates to see.
            </p>

            <form onSubmit={handleSaveNote}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {['📚', '💻', '🌲', '🧬', '📐', '⏳', '⚡'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setSelectedEmoji(em)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: selectedEmoji === em ? 'rgba(64, 227, 120, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: selectedEmoji === em ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: 18,
                      cursor: 'pointer',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="What are you studying right now?"
                maxLength={60}
                value={noteInputText}
                onChange={(e) => setNoteInputText(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 16,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateNoteModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 14,
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
                  disabled={!noteInputText.trim() || savingNote}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 14,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: noteInputText.trim() ? 'pointer' : 'not-allowed',
                    opacity: noteInputText.trim() ? 1 : 0.6,
                  }}
                >
                  {savingNote ? 'Sharing…' : 'Share Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
