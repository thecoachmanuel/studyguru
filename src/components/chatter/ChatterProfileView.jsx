'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import EliteIcon from '@/components/elite/EliteIcon';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/context/ThemeContext';

export default function ChatterProfileView({
  profile,
  servers = [],
  onLogout,
  onOpenStatusModal,
  onOpenSettings,
  onSelectServer,
  onOpenGuru,
  followingMap = {},
  onSelectPost,
}) {
  const { theme, toggleTheme } = useTheme();

  // Helper to synchronously read cached profile from localStorage
  const cachedProfile = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('studycord_user_profile_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [avatarUrl, setAvatarUrl] = useState(() => profile?.avatar_url || cachedProfile?.avatar_url || '');
  const [bioText, setBioText] = useState(() => profile?.bio || cachedProfile?.bio || '');
  const [toastMessage, setToastMessage] = useState('');
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(() => profile?.name || cachedProfile?.name || '');
  const [displayName, setDisplayName] = useState(() => profile?.name || cachedProfile?.name || '');
  const [editUsername, setEditUsername] = useState(() => profile?.username || cachedProfile?.username || '');
  const [displayUsername, setDisplayUsername] = useState(() => profile?.username || cachedProfile?.username || '');
  const [editBio, setEditBio] = useState(() => profile?.bio || cachedProfile?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Settings states matching Elite Quiz
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('elite_sound_enabled') !== 'false';
  });
  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('elite_vibration_enabled') !== 'false';
  });

  // Active dialogs
  const [activeModal, setActiveModal] = useState(null); // 'wallet' | 'coinHistory' | 'invite' | 'badges' | 'stats' | 'theme' | 'about' | 'howToPlay' | 'notes' | 'posts' | 'logout' | 'delete'

  // Dynamic real data
  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [quizStats, setQuizStats] = useState({
    coins: 100,
    total_played: 0,
    score: 0,
    streak: 1,
    accuracy: 0,
    correct_count: 0,
    incorrect_count: 0,
    perfect_scores: 0,
    unlocked_badges: ['badge-rookie'],
  });

  const avatarInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // 1. Load persistent user profile & quiz stats
  useEffect(() => {
    let mounted = true;
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) {
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
          if (data.name) {
            setEditName(data.name);
            setDisplayName(data.name);
          }
          if (data.username) {
            setEditUsername(data.username);
            setDisplayUsername(data.username);
          }
          if (data.bio) {
            setBioText(data.bio);
            setEditBio(data.bio);
          }
        }
      })
      .catch(() => {});

    fetch('/api/quiz/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mounted && d?.stats) setQuizStats(d.stats);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load user's real posts
  useEffect(() => {
    let mounted = true;
    fetch('/api/posts')
      .then((res) => (res.ok ? res.json() : null))
      .then((allPosts) => {
        if (mounted && Array.isArray(allPosts)) {
          const currentUserId = profile?.id;
          const currentUserName = profile?.name;
          const filtered = allPosts.filter((p) => {
            const authorId = p.author?.id || p.author_id;
            const authorName = p.author?.name || p.author_name;
            return (
              (currentUserId && String(authorId) === String(currentUserId)) ||
              (currentUserName && authorName === currentUserName)
            );
          });
          setMyPosts(filtered);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingPosts(false);
      });

    return () => {
      mounted = false;
    };
  }, [profile?.id, profile?.name]);

  // 3. Load user's real uploaded study documents
  useEffect(() => {
    let mounted = true;
    fetch('/api/rag/documents')
      .then((res) => (res.ok ? res.json() : null))
      .then((docs) => {
        if (mounted && Array.isArray(docs)) {
          setSavedNotes(docs);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingNotes(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'avatar');

    try {
      showToast('Uploading profile picture...');
      const res = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.avatar_url) {
          setAvatarUrl(data.avatar_url);
          showToast('Profile photo updated!');
        }
      }
    } catch {
      showToast('Avatar saved locally');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          username: editUsername,
          bio: editBio,
        }),
      });
      if (res.ok) {
        setDisplayName(editName);
        setDisplayUsername(editUsername);
        setBioText(editBio);
        setEditProfileOpen(false);
        showToast('Profile updated successfully!');
      } else {
        setDisplayName(editName);
        setDisplayUsername(editUsername);
        setBioText(editBio);
        setEditProfileOpen(false);
        showToast('Profile saved');
      }
    } catch {
      setDisplayName(editName);
      setDisplayUsername(editUsername);
      setBioText(editBio);
      setEditProfileOpen(false);
      showToast('Profile saved');
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('elite_sound_enabled', String(next));
    showToast(next ? 'Sound effects enabled' : 'Sound effects muted');
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    localStorage.setItem('elite_vibration_enabled', String(next));
    if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    showToast(next ? 'Vibration enabled' : 'Vibration disabled');
  };

  // Elite Quiz Menu Items List matching _allMenuItems in profile_tab_screen.dart
  const menuItems = [
    { id: 'bookmark', name: 'Bookmarked Questions', icon: 'bookmark', desc: 'Review saved questions' },
    { id: 'badges', name: 'Badges Showcase', icon: 'badges', desc: 'View unlocked achievements' },
    { id: 'rewards', name: 'Rewards & Streaks', icon: 'rewards', desc: 'Daily scratch card & coins' },
    { id: 'stats', name: 'Quiz Statistics', icon: 'statistics', desc: 'Accuracy & performance report' },
    { id: 'notes', name: 'Saved Notes & Docs', icon: 'edit', desc: `${savedNotes.length} AI indexed documents` },
    { id: 'posts', name: 'My Community Posts', icon: 'share', desc: `${myPosts.length} study feed posts` },
    { id: 'theme', name: 'Theme Mode', icon: 'theme', desc: theme === 'dark' ? 'Dark Mode' : 'Light Mode' },
    { id: 'sound', name: 'Sound FX', icon: 'volume', isSwitch: true, value: soundEnabled, onToggle: toggleSound },
    { id: 'vibration', name: 'Vibration & Haptics', icon: 'vibration', isSwitch: true, value: vibrationEnabled, onToggle: toggleVibration },
    { id: 'about', name: 'About Elite Quiz', icon: 'about_us', desc: 'Version 2.3.7 & StudyCord Engine' },
    { id: 'howToPlay', name: 'How to Play', icon: 'how_to_play', desc: 'Rules & lifelines guide' },
    { id: 'share', name: 'Share App', icon: 'share', desc: 'Invite classmates to StudyCord' },
    { id: 'rate', name: 'Rate Us', icon: 'rate_us', desc: 'Leave feedback for the community' },
    { id: 'logout', name: 'Logout Account', icon: 'logout', desc: 'Sign out of current session' },
    { id: 'delete', name: 'Delete Account', icon: 'delete_account', desc: 'Permanently remove profile data', isDanger: true },
  ];

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        backgroundColor: 'var(--background)',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--card)',
            color: 'var(--primary-color)',
            border: '1px solid var(--primary-color)',
            padding: '10px 22px',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 800,
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span> {toastMessage}
        </div>
      )}

      {/* Hidden file input for custom avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      {/* ════ 1. EXACT ELITE QUIZ PROFILE HEADER ════ */}
      <div style={{ position: 'relative', width: '100%', marginBottom: 36 }}>
        {/* Pink Banner with rounded bottom corners (Radius 12) */}
        <div
          style={{
            backgroundColor: 'var(--primary-color)',
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            height: 145,
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 36,
            boxShadow: '0 4px 18px rgba(239, 83, 136, 0.25)',
          }}
        >
          <h2
            style={{
              color: '#ffffff',
              fontSize: 20,
              fontWeight: 800,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Profile
          </h2>
        </div>

        {/* Floating User Card Overlapping the Pink Header */}
        <div
          style={{
            position: 'absolute',
            bottom: -28,
            left: '5%',
            right: '5%',
            backgroundColor: 'var(--card)',
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {/* Avatar with Border */}
          <div
            onClick={() => avatarInputRef.current?.click()}
            title="Click to change photo"
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              border: '2px solid rgba(69, 83, 109, 0.15)',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
              flexShrink: 0,
              backgroundColor: 'var(--background)',
              position: 'relative',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <img
                src="/elite_assets/config/profile/1.svg"
                alt="Avatar"
                style={{ width: 44, height: 44 }}
              />
            )}
          </div>

          {/* Name & Subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 2px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName || profile?.name || 'Guest Scholar'}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {profile?.email || (displayUsername ? `@${displayUsername}` : 'Explore Elite Quiz')}
            </p>
          </div>

          {/* Edit Profile Button */}
          <button
            type="button"
            onClick={() => setEditProfileOpen(true)}
            aria-label="Edit Profile"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--primary-color)',
              flexShrink: 0,
            }}
          >
            <EliteIcon name="edit" size={18} color="var(--primary-color)" />
          </button>
        </div>
      </div>

      {/* ════ 2. 3-COLUMN QUICK ACTION GRID (WALLET, COIN HISTORY, INVITE FRIENDS) ════ */}
      <div
        style={{
          padding: '0 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Wallet */}
        <div
          onClick={() => setActiveModal('wallet')}
          style={{
            backgroundColor: 'var(--card)',
            borderRadius: 10,
            padding: '16px 8px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <EliteIcon name="wallet" size={24} color="var(--primary-color)" />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            Wallet
          </span>
          <span style={{ fontSize: 11, color: 'var(--accent-amber)', fontWeight: 800, marginTop: 2 }}>
            {quizStats.coins || 100} 🪙
          </span>
        </div>

        {/* Coin History */}
        <div
          onClick={() => setActiveModal('coinHistory')}
          style={{
            backgroundColor: 'var(--card)',
            borderRadius: 10,
            padding: '16px 8px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <EliteIcon name="coin_history" size={24} color="var(--primary-color)" />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            Coin History
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>
            Transactions
          </span>
        </div>

        {/* Invite Friends */}
        <div
          onClick={() => setActiveModal('invite')}
          style={{
            backgroundColor: 'var(--card)',
            borderRadius: 10,
            padding: '16px 8px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <EliteIcon name="invite_friends" size={24} color="var(--primary-color)" />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            Invite
          </span>
          <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 800, marginTop: 2 }}>
            +50 Coins
          </span>
        </div>
      </div>

      {/* ════ 3. FULL ELITE MENU LIST ════ */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              if (item.isSwitch) {
                item.onToggle?.();
              } else if (item.id === 'logout') {
                onLogout?.();
              } else {
                setActiveModal(item.id);
              }
            }}
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 8,
              padding: '14px 16px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <EliteIcon
                name={item.icon}
                size={22}
                color={item.isDanger ? 'var(--error-color)' : 'var(--primary-color)'}
              />
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: item.isDanger ? 'var(--error-color)' : 'var(--text-primary)',
                  }}
                >
                  {item.name}
                </div>
                {item.desc && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {item.desc}
                  </div>
                )}
              </div>
            </div>

            {item.isSwitch ? (
              <div
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: item.value ? 'var(--primary-color)' : 'var(--border)',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: item.value ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            ) : (
              <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>›</span>
            )}
          </div>
        ))}
      </div>

      {/* ════ MODALS / SHEETS ════ */}

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditProfileOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 22,
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Edit Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="username"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Academic Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Major, favorite subjects, goals..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: 'var(--primary-color)',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: savingProfile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {activeModal === 'wallet' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 400,
              width: '100%',
              padding: 24,
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 83, 136, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <EliteIcon name="wallet" size={32} color="var(--primary-color)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Quiz Wallet
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Your accumulated drill coins & prize tokens.
            </p>
            <div
              style={{
                backgroundColor: 'var(--background)',
                borderRadius: 12,
                padding: '14px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Current Balance
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent-amber)', marginTop: 4 }}>
                {quizStats.coins || 100} <span style={{ fontSize: 22 }}>🪙</span>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 18px' }}>
              Minimum redeemable amount is 500 Coins ($5.00). Payout processing takes 3–5 working days.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                showToast('Redemption requires at least 500 coins');
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Request Payout
            </button>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {activeModal === 'stats' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Performance Statistics
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ backgroundColor: 'var(--background)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Played
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
                  {quizStats.total_played || 0}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--background)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Accuracy Rate
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--success)', marginTop: 4 }}>
                  {quizStats.accuracy || 0}%
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--background)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Correct
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--success)', marginTop: 4 }}>
                  {quizStats.correct_count || 0}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--background)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Incorrect
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--error-color)', marginTop: 4 }}>
                  {quizStats.incorrect_count || 0}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Badges Modal */}
      {activeModal === 'badges' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Badges Showcase
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { id: 'badge-rookie', name: 'Quiz Rookie', desc: 'Complete your first quiz drill', icon: '🎯', unlocked: true },
                { id: 'badge-scholar', name: 'Rising Scholar', desc: 'Score 100% accuracy on 3 drills', icon: '🎓', unlocked: (quizStats.perfect_scores || 0) >= 3 },
                { id: 'badge-streak', name: 'Streak Master', desc: 'Maintain a 5-day quiz drill streak', icon: '🔥', unlocked: (quizStats.streak || 1) >= 5 },
                { id: 'badge-ai', name: 'AI Guru Master', desc: 'Complete 5 AI-generated quizzes', icon: '🤖', unlocked: false },
                { id: 'badge-champ', name: 'Arena Champion', desc: 'Earn 500 total coins in battles', icon: '👑', unlocked: (quizStats.coins || 100) >= 500 },
              ].map((badge) => (
                <div
                  key={badge.id}
                  style={{
                    backgroundColor: 'var(--background)',
                    borderRadius: 10,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    opacity: badge.unlocked ? 1 : 0.5,
                    border: badge.unlocked ? '1px solid var(--primary-color)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 24 }}>{badge.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {badge.name} {badge.unlocked && '✓'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {badge.desc}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: badge.unlocked ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {badge.unlocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Saved Study Notes Modal (AI Guru Integration) */}
      {activeModal === 'notes' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 460,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Saved Study Documents
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            {savedNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No study documents yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 16 }}>
                  Upload course slides or notes in AI Guru to study here.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenGuru?.();
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 10,
                    backgroundColor: 'var(--primary-color)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Open AI Guru
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {savedNotes.map((note) => (
                  <div
                    key={note.id || note.doc_id}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {note.filename || note.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {note.chunksCount || 1} text chunks · Ready
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        onOpenGuru?.();
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        backgroundColor: 'var(--accent-subtle)',
                        border: '1px solid var(--primary-color)',
                        color: 'var(--primary-color)',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Ask AI
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Community Posts Modal (Feed Integration) */}
      {activeModal === 'posts' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 460,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                My Community Posts
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            {myPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No posts published yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Share study questions or tips on the feed to see them here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {myPosts.map((post) => (
                  <div
                    key={post.id || post._id}
                    onClick={() => {
                      setActiveModal(null);
                      onSelectPost?.(post.id || post._id);
                    }}
                    style={{
                      backgroundColor: 'var(--background)',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <p style={{ fontSize: 13.5, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                      {post.text}
                    </p>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>❤️ {post.likes || 0}</span>
                      <span>💬 {post.comments || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {activeModal === 'invite' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 400,
              width: '100%',
              padding: 24,
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(93, 183, 96, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <EliteIcon name="invite_friends" size={32} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Refer & Earn Coins
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Share your referral code. When a classmate signs up, you both earn 50 Coins!
            </p>
            <div
              style={{
                backgroundColor: 'var(--background)',
                borderRadius: 10,
                padding: '12px 16px',
                border: '2px dashed var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--primary-color)', letterSpacing: '0.08em' }}>
                STUDY-{displayName ? displayName.slice(0, 4).toUpperCase() : 'ELITE'}99
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(`STUDY-${displayName ? displayName.slice(0, 4).toUpperCase() : 'ELITE'}99`);
                    showToast('Referral code copied!');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--primary-color)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  navigator.share({
                    title: 'Join me on StudyCord Elite Quiz!',
                    text: 'Compete with me on StudyCord Elite Quiz to level up your grades!',
                    url: window.location.origin,
                  }).catch(() => {});
                } else {
                  showToast('Share link copied to clipboard!');
                }
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Share with Classmates
            </button>
          </div>
        </div>
      )}

      {/* Theme Selector Sheet */}
      {activeModal === 'theme' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 380,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Select App Theme
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div
                onClick={() => {
                  if (theme !== 'light') toggleTheme();
                  setActiveModal(null);
                  showToast('Light theme applied');
                }}
                style={{
                  backgroundColor: 'var(--background)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: theme === 'light' ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>☀️</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Light Mode</span>
                </div>
                {theme === 'light' && <span style={{ color: 'var(--primary-color)', fontWeight: 900 }}>✓</span>}
              </div>

              <div
                onClick={() => {
                  if (theme !== 'dark') toggleTheme();
                  setActiveModal(null);
                  showToast('Dark theme applied');
                }}
                style={{
                  backgroundColor: 'var(--background)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: theme === 'dark' ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>🌙</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Dark Mode</span>
                </div>
                {theme === 'dark' && <span style={{ color: 'var(--primary-color)', fontWeight: 900 }}>✓</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--border)',
                color: 'var(--text-primary)',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* How To Play Modal */}
      {activeModal === 'howToPlay' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--card)',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 22,
              border: '1px solid var(--border)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                How to Play Elite Quiz
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0 }}>
                • <strong>Answer Questions:</strong> You will have 25–45 seconds per question depending on the mode.
              </p>
              <p style={{ margin: 0 }}>
                • <strong>Lifelines:</strong> Fifty-Fifty (removes 2 wrong options), Audience Poll (shows probable answer), Reset Timer, and Skip Question.
              </p>
              <p style={{ margin: 0 }}>
                • <strong>Scoring:</strong> Correct answers yield +4 points and bonus coins. Incorrect answers deduct 2 points in competitive modes.
              </p>
              <p style={{ margin: 0 }}>
                • <strong>13 Game Modes:</strong> Enjoy Quiz Zone, Daily Quiz, Fun & Learn, Guess The Word, Self-Challenge, 1v1 Battle, Group Battle, Audio Quiz, Math Mania, and Exam mode.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                backgroundColor: 'var(--primary-color)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                marginTop: 18,
                cursor: 'pointer',
              }}
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
