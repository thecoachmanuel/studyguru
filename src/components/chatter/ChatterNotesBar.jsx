'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export default function ChatterNotesBar({
  user,
  profile,
  followingMap = {},
  onOpenLiveSpaces,
}) {
  const [userNote, setUserNote] = useState(null);
  const [notes, setNotes] = useState([
    {
      id: 'note-sarah',
      author: {
        id: 'u-sarah',
        name: 'Sarah Chen',
        username: 'schen_ai',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      },
      text: 'Reviewing vector line integrals & Stokes Theorem 📐',
      emoji: '📐',
      timestamp: '35m ago',
    },
    {
      id: 'note-alex',
      author: {
        id: 'u-alex',
        name: 'Alex Rivera',
        username: 'arivera_cs',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      },
      text: 'Flashcards on Self-Attention & Transformer Q, K, V matrices 🧠',
      emoji: '🧠',
      timestamp: '1h ago',
    },
    {
      id: 'note-jordan',
      author: {
        id: 'u-jordan',
        name: 'Jordan Lee',
        username: 'jlee_stats',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Applied statistics: Markov Chains & stationary dist 📊',
      emoji: '📊',
      timestamp: '2h ago',
    },
    {
      id: 'note-maya',
      author: {
        id: 'u-maya',
        name: 'Maya Patel',
        username: 'mpatel_math',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      },
      text: 'Abstract algebra: Ring isomorphisms and ideal kernels 🔬',
      emoji: '🔬',
      timestamp: '3h ago',
    },
  ]);

  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [createNoteModalOpen, setCreateNoteModalOpen] = useState(false);
  const [noteInputText, setNoteInputText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [savingNote, setSavingNote] = useState(false);

  const [viewedNoteIds, setViewedNoteIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('studycord_viewed_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const markNoteAsViewed = (id) => {
    if (!id || id === 'my-note') return;
    setViewedNoteIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('studycord_viewed_notes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Group notes by author so multiple stories from one scholar are grouped
  const authorGroups = useMemo(() => {
    const groups = [];
    const authorMap = new Map();

    notes.forEach((note) => {
      const aId = note.author?.id || note.id;
      if (!authorMap.has(aId)) {
        const groupObj = {
          authorId: aId,
          author: note.author,
          notes: [note],
        };
        authorMap.set(aId, groupObj);
        groups.push(groupObj);
      } else {
        authorMap.get(aId).notes.push(note);
      }
    });

    // An author is considered fully viewed ONLY if ALL their stories have been viewed
    return groups.map((g) => ({
      ...g,
      isFullyViewed: g.notes.every((n) => viewedNoteIds.includes(n.id)),
      hasUnviewed: g.notes.some((n) => !viewedNoteIds.includes(n.id)),
      latestEmoji: g.notes[g.notes.length - 1]?.emoji || '📚',
    }));
  }, [notes, viewedNoteIds]);

  // Priority sorting:
  // 1. Followed scholars that have unviewed notes
  // 2. Other scholars that have unviewed notes
  // 3. Followed scholars whose notes have been viewed
  // 4. Other viewed notes
  const sortedAuthorGroups = useMemo(() => {
    return [...authorGroups].sort((a, b) => {
      const aFollow = Boolean(followingMap[a.authorId] || a.notes.some((n) => n.is_following));
      const bFollow = Boolean(followingMap[b.authorId] || b.notes.some((n) => n.is_following));
      const aUnviewed = a.hasUnviewed;
      const bUnviewed = b.hasUnviewed;

      if (aUnviewed && bUnviewed) {
        if (aFollow && !bFollow) return -1;
        if (!aFollow && bFollow) return 1;
        return 0;
      }
      if (aUnviewed && !bUnviewed) return -1;
      if (!aUnviewed && bUnviewed) return 1;

      if (aFollow && !bFollow) return -1;
      if (!aFollow && bFollow) return 1;
      return 0;
    });
  }, [authorGroups, followingMap]);

  // Load user's saved status note and real community note statuses on mount
  useEffect(() => {
    fetch('/api/user/status?feed=true')
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
        if (Array.isArray(data?.notes) && data.notes.length > 0) {
          setNotes(data.notes);
        }
      })
      .catch(() => {});
  }, []);

  // Modal viewer session: stable snapshot of stories currently being viewed
  const [viewerStories, setViewerStories] = useState([]);
  const [activeAuthorGroupIndex, setActiveAuthorGroupIndex] = useState(null); // -1 for userNote, 0..N for sortedAuthorGroups
  const [isStoryPaused, setIsStoryPaused] = useState(false);

  // Advance to next story segment or seamlessly roll to next person's status
  const handleNextStory = useCallback(() => {
    setViewerStories((currentStories) => {
      setActiveStoryIndex((currStoryIdx) => {
        if (currStoryIdx === null) return null;

        // 1. Advance to next story of the same author
        if (currStoryIdx < currentStories.length - 1) {
          setStoryProgress(0);
          return currStoryIdx + 1;
        }

        // 2. Current author's stories finished: roll to next author!
        if (activeAuthorGroupIndex === -1) {
          // Finished viewing user's own note: advance to first classmate status if available
          if (sortedAuthorGroups.length > 0) {
            setActiveAuthorGroupIndex(0);
            const nextStories = sortedAuthorGroups[0].notes;
            const unviewedIdx = nextStories.findIndex((n) => !viewedNoteIds.includes(n.id));
            const startIdx = unviewedIdx >= 0 ? unviewedIdx : 0;
            // Schedule setting new stories
            setTimeout(() => {
              setViewerStories(nextStories);
              setActiveStoryIndex(startIdx);
              setStoryProgress(0);
            }, 0);
            return null;
          } else {
            // No other stories
            setActiveAuthorGroupIndex(null);
            setViewerStories([]);
            return null;
          }
        } else if (activeAuthorGroupIndex !== null && activeAuthorGroupIndex < sortedAuthorGroups.length - 1) {
          const nextAuthorIdx = activeAuthorGroupIndex + 1;
          const nextGroup = sortedAuthorGroups[nextAuthorIdx];
          setActiveAuthorGroupIndex(nextAuthorIdx);
          const nextStories = nextGroup.notes;
          const unviewedIdx = nextStories.findIndex((n) => !viewedNoteIds.includes(n.id));
          const startIdx = unviewedIdx >= 0 ? unviewedIdx : 0;
          setTimeout(() => {
            setViewerStories(nextStories);
            setActiveStoryIndex(startIdx);
            setStoryProgress(0);
          }, 0);
          return null;
        } else {
          // All authors finished
          setActiveAuthorGroupIndex(null);
          setViewerStories([]);
          return null;
        }
      });
      return currentStories;
    });
  }, [activeAuthorGroupIndex, sortedAuthorGroups, viewedNoteIds]);

  // Go back to previous story segment or roll back to previous author
  const handlePrevStory = useCallback(() => {
    setActiveStoryIndex((currStoryIdx) => {
      if (currStoryIdx === null) return null;

      if (currStoryIdx > 0) {
        setStoryProgress(0);
        return currStoryIdx - 1;
      }

      // At index 0: go back to previous author
      if (activeAuthorGroupIndex > 0) {
        const prevAuthorIdx = activeAuthorGroupIndex - 1;
        const prevGroup = sortedAuthorGroups[prevAuthorIdx];
        setActiveAuthorGroupIndex(prevAuthorIdx);
        setViewerStories(prevGroup.notes);
        setStoryProgress(0);
        return prevGroup.notes.length - 1;
      } else if (activeAuthorGroupIndex === 0 && userNote) {
        // Roll back to user's own note
        const myStory = {
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
        };
        setActiveAuthorGroupIndex(-1);
        setViewerStories([myStory]);
        setStoryProgress(0);
        return 0;
      }

      return 0;
    });
  }, [activeAuthorGroupIndex, sortedAuthorGroups, userNote, user, profile]);

  // Open story viewer for a specific author group
  const handleOpenAuthorStories = (group, index) => {
    const authorStories = group.notes;
    const firstUnviewedIdx = authorStories.findIndex((n) => !viewedNoteIds.includes(n.id));
    const startIdx = firstUnviewedIdx >= 0 ? firstUnviewedIdx : 0;
    const groupIdx = typeof index === 'number' ? index : sortedAuthorGroups.findIndex((g) => g.authorId === group.authorId);

    setActiveAuthorGroupIndex(groupIdx >= 0 ? groupIdx : 0);
    setViewerStories(authorStories);
    setActiveStoryIndex(startIdx);
    setStoryProgress(0);

    const currentStory = authorStories[startIdx];
    if (currentStory && currentStory.id !== 'my-note') {
      markNoteAsViewed(currentStory.id);
    }
  };

  const handleOpenUserNote = () => {
    if (!userNote) {
      setCreateNoteModalOpen(true);
      return;
    }
    const myStory = {
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
    };
    setActiveAuthorGroupIndex(-1);
    setViewerStories([myStory]);
    setActiveStoryIndex(0);
    setStoryProgress(0);
  };

  // Story Viewer Timer: auto-advance progress and seamlessly transition across authors
  useEffect(() => {
    if (activeStoryIndex === null || viewerStories.length === 0) {
      setStoryProgress(0);
      return;
    }

    const currentStory = viewerStories[activeStoryIndex];
    if (currentStory && currentStory.id !== 'my-note') {
      markNoteAsViewed(currentStory.id);
    }

    const DURATION_MS = 4200;
    const INTERVAL_MS = 40;
    const step = 100 / (DURATION_MS / INTERVAL_MS);

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (isStoryPaused) return prev; // Pause story when held down
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + step;
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [activeStoryIndex, viewerStories, isStoryPaused, handleNextStory]);

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

  return (
    <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: 'var(--chatter-black)', position: 'relative', zIndex: 1 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '4px 2px',
          alignItems: 'flex-start',
        }}
      >
        {/* ── 1. User Note Item (+) ── */}
        <div
          onClick={handleOpenUserNote}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            width: 72,
          }}
        >
          {/* Note Bubble or Action Pill */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (userNote) {
                handleOpenUserNote();
              } else {
                setCreateNoteModalOpen(true);
              }
            }}
            style={{
              background: 'var(--chatter-sheet)',
              border: userNote ? '1px solid var(--chatter-primary)' : '1px dashed rgba(255, 255, 255, 0.2)',
              borderRadius: 14,
              padding: '3px 8px',
              fontSize: 12.5,
              fontWeight: 600,
              color: userNote ? '#fff' : 'var(--chatter-light-text)',
              maxWidth: 72,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            title={userNote ? userNote.text : 'Share a note'}
          >
            {userNote ? `${userNote.emoji} ${userNote.text}` : '+ Note'}
          </div>

          {/* Avatar with (+) badge or status emoji */}
          <div style={{ position: 'relative', width: 56, height: 56 }}>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Your Avatar"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: userNote ? '2px solid var(--chatter-primary)' : '2px solid rgba(255, 255, 255, 0.15)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#242424',
                  color: 'var(--chatter-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 20,
                  border: userNote ? '2px solid var(--chatter-primary)' : '2px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {profile?.name?.[0]?.toUpperCase() || 'Y'}
              </div>
            )}

            {/* Plus / Emoji Badge */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setCreateNoteModalOpen(true);
              }}
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: userNote ? 'var(--chatter-sheet)' : 'var(--chatter-primary)',
                color: userNote ? '#fff' : '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: userNote ? 12.5 : 14,
                fontWeight: 900,
                border: '2px solid var(--chatter-black)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              {userNote ? userNote.emoji : '+'}
            </div>
          </div>

          <span
            style={{
              fontSize: 13.5,
              color: 'var(--chatter-light-text)',
              marginTop: 6,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Your Note
          </span>
        </div>

        {/* ── 2. Classmate Author Stories (Clean bubbles without floating tags) ── */}
        {sortedAuthorGroups.map((group, groupIdx) => {
          const isViewed = group.isFullyViewed;
          const author = group.author || { name: 'Scholar', avatar_url: '' };

          return (
            <div
              key={group.authorId}
              onClick={() => handleOpenAuthorStories(group, groupIdx)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                width: 72,
                transition: 'opacity 0.2s ease, transform 0.15s ease',
                opacity: isViewed ? 0.72 : 1,
                paddingTop: 28, // Matches top height alignment since floating tag is removed
              }}
            >
              {/* Avatar with Stories Ring: Vibrant gradient if ANY story unviewed; sleek gray outline ONLY if ALL viewed */}
              <div style={{ position: 'relative', width: 56, height: 56 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    padding: 2.5,
                    background: isViewed
                      ? 'rgba(255, 255, 255, 0.22)'
                      : 'linear-gradient(45deg, var(--chatter-primary), #3b82f6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <img
                    src={author.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                    alt={author.name}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--chatter-black)',
                    }}
                  />
                </div>

                {/* Clean emoji badge on avatar bottom-right */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--chatter-sheet)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    border: '1.5px solid var(--chatter-black)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  }}
                >
                  {group.latestEmoji}
                </div>
              </div>

              <span
                style={{
                  fontSize: 13.5,
                  color: isViewed ? 'var(--chatter-light-text)' : '#fff',
                  marginTop: 6,
                  textAlign: 'center',
                  fontWeight: 600,
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {author.name?.split(' ')[0] || 'Scholar'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── 3. Story Viewer Modal (Auto-advancing progress bar) ── */}
      {activeStoryIndex !== null && viewerStories[activeStoryIndex] && (
        <div
          onPointerDown={() => setIsStoryPaused(true)}
          onPointerUp={() => setIsStoryPaused(false)}
          onPointerCancel={() => setIsStoryPaused(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.94)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 20px',
            animation: 'fadeIn 0.2s ease',
            userSelect: 'none',
          }}
        >
          {/* Top Story Progress Bars */}
          <div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
              {viewerStories.map((st, i) => {
                let fillPercent = 0;
                if (i < activeStoryIndex) fillPercent = 100;
                else if (i === activeStoryIndex) fillPercent = storyProgress;
                return (
                  <div
                    key={st.id || i}
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
                  src={viewerStories[activeStoryIndex].author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                  alt="Story Author"
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: '#fff' }}>
                    {viewerStories[activeStoryIndex].author?.name || 'Scholar'}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--chatter-light-text)' }}>
                    @{viewerStories[activeStoryIndex].author?.username || 'scholar'} · {viewerStories[activeStoryIndex].timestamp}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveStoryIndex(null);
                  setViewerStories([]);
                  setActiveAuthorGroupIndex(null);
                }}
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
            {/* Left Tap Zone (Previous Story / Previous Author) */}
            <div
              onClick={handlePrevStory}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '35%',
                cursor: 'pointer',
                zIndex: 5,
              }}
            />

            {/* Right Tap Zone (Next Story / Next Author) */}
            <div
              onClick={handleNextStory}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '35%',
                cursor: 'pointer',
                zIndex: 5,
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
                {viewerStories[activeStoryIndex].emoji || '📚'}
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                &ldquo;{viewerStories[activeStoryIndex].text}&rdquo;
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', margin: 0 }}>
                Study Status on StudyCord
              </p>
            </div>
          </div>

          {/* Bottom Tap Navigation Info */}
          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--chatter-light-text)' }}>
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
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
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

            <p style={{ fontSize: 14, color: 'var(--chatter-light-text)', margin: '0 0 16px 0' }}>
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
                  fontSize: 16,
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
                    fontSize: 14.5,
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
                    fontSize: 14.5,
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
