'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

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
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'notes' | 'rooms'
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bioText, setBioText] = useState('📚 Studying & collaborating on StudyCord · Always open to join study rooms & exam drills!');
  const [toastMessage, setToastMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [displayUsername, setDisplayUsername] = useState(profile?.username || '');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Dynamic real data
  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [savedNotes, setSavedNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [followersCount, setFollowersCount] = useState(
    typeof profile?.followers_count === 'number' ? profile.followers_count : 0
  );
  const [dayStreak, setDayStreak] = useState(
    typeof profile?.day_streak === 'number' ? profile.day_streak : 1
  );
  const [studyHours, setStudyHours] = useState(
    typeof profile?.study_hours === 'number' ? profile.study_hours : 0
  );

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const followingCount = useMemo(() => {
    const fromMap = Object.values(followingMap).filter(Boolean).length;
    if (fromMap > 0) return fromMap;
    return typeof profile?.following_count === 'number' ? profile.following_count : 0;
  }, [followingMap, profile?.following_count]);

  useEffect(() => {
    if (typeof profile?.followers_count === 'number') setFollowersCount(profile.followers_count);
    if (typeof profile?.day_streak === 'number') setDayStreak(profile.day_streak);
    if (typeof profile?.study_hours === 'number') setStudyHours(profile.study_hours);
  }, [profile?.followers_count, profile?.day_streak, profile?.study_hours]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // 1. Load persistent user profile & stats
  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            if (data.avatar_url) setAvatarUrl(data.avatar_url);
            if (data.banner_url) setBannerUrl(data.banner_url);
            if (data.bio) {
              setBioText(data.bio);
              setEditBio(data.bio);
            }
            if (data.name) {
              setEditName(data.name);
              setDisplayName(data.name);
            }
            if (data.username) {
              setEditUsername(data.username);
              setDisplayUsername(data.username);
            }
            if (typeof data.followers_count === 'number') setFollowersCount(data.followers_count);
            if (typeof data.day_streak === 'number') setDayStreak(data.day_streak);
            if (typeof data.study_hours === 'number') setStudyHours(data.study_hours);
          }
        }
      } catch (err) {
        console.warn('Profile load notice:', err);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load user's real posts from /api/posts
  useEffect(() => {
    let mounted = true;
    const fetchUserPosts = async () => {
      try {
        const res = await fetch('/api/posts');
        if (res.ok) {
          const allPosts = await res.json();
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
        }
      } catch (err) {
        console.warn('Failed to load user posts:', err);
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    };

    fetchUserPosts();
    return () => {
      mounted = false;
    };
  }, [profile?.id, profile?.name]);

  // 3. Load user's real uploaded study notes from /api/rag/documents
  useEffect(() => {
    let mounted = true;
    const fetchNotes = async () => {
      try {
        const res = await fetch('/api/rag/documents');
        if (res.ok) {
          const docs = await res.json();
          if (mounted && Array.isArray(docs)) {
            setSavedNotes(docs);
            // Calculate dynamic study hours based on notes & posts
            setStudyHours(Math.max(4, docs.length * 3 + myPosts.length));
          }
        }
      } catch (err) {
        console.warn('Failed to load notes:', err);
      } finally {
        if (mounted) setLoadingNotes(false);
      }
    };

    fetchNotes();
    return () => {
      mounted = false;
    };
  }, [myPosts.length]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    showToast('Uploading profile photo...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', 'studycord/avatars');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const finalUrl = uploadData.url;

      setAvatarUrl(finalUrl);

      // Save to MongoDB profile
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: finalUrl }),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('studycord_profile_updated', {
            detail: { avatar_url: finalUrl },
          })
        );
      }

      showToast('Profile photo saved!');
    } catch (err) {
      console.warn('Avatar upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('studycord_profile_updated', {
              detail: { avatar_url: reader.result },
            })
          );
        }
        showToast('Profile photo updated!');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    showToast('Uploading cover banner...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', 'studycord/banners');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const finalUrl = uploadData.url;

      setBannerUrl(finalUrl);

      // Save to MongoDB profile
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_url: finalUrl }),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('studycord_profile_updated', {
            detail: { banner_url: finalUrl },
          })
        );
      }

      showToast('Cover banner saved!');
    } catch (err) {
      console.warn('Banner upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setBannerUrl(reader.result);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('studycord_profile_updated', {
              detail: { banner_url: reader.result },
            })
          );
        }
        showToast('Cover banner updated!');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveProfileModal = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updatedData = {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: editBio.trim(),
      };
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (res.ok) {
        setDisplayName(editName.trim());
        if (editUsername) setDisplayUsername(editUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
        setBioText(editBio.trim());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('studycord_profile_updated', {
              detail: updatedData,
            })
          );
        }
        showToast('Profile updated successfully!');
        setEditProfileOpen(false);
      } else {
        throw new Error('Update failed');
      }
    } catch {
      showToast('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', width: '100%', position: 'relative' }}>
      {/* Toast popup */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--chatter-sheet)',
            color: 'var(--chatter-primary)',
            border: '1px solid var(--chatter-primary)',
            padding: '8px 18px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>✓</span> {toastMessage}
        </div>
      )}

      {/* Hidden File Inputs for Banner and Avatar */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBannerChange}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />

      {/* ── 1. Cover Banner with Edit Trigger & Settings Icon ── */}
      <div
        style={{
          height: 150,
          background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : 'linear-gradient(135deg, #183321 0%, #0E0E0E 100%)',
          position: 'relative',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Banner Edit Button */}
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            borderRadius: 20,
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Update Cover Banner"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Edit Banner</span>
        </button>

        {/* Settings / Edit Profile Trigger (As requested, settings icon works to edit profile) */}
        <button
          type="button"
          onClick={() => {
            setEditBio(bioText);
            setEditName(displayName || profile?.name || '');
            setEditUsername(displayUsername || profile?.username || '');
            setEditProfileOpen(true);
          }}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'var(--chatter-primary)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          title="Edit Profile & Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* ── 2. Profile Details & Avatar with Photo Picker ── */}
      <div style={{ padding: '0 20px', position: 'relative', marginTop: -46 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          {/* Avatar with Ring & Camera Trigger */}
          <div style={{ position: 'relative' }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.name || 'Scholar'}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3.5px solid var(--chatter-black)',
                  boxShadow: '0 0 0 2px var(--chatter-primary)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: '#242424',
                  color: 'var(--chatter-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 30,
                  border: '3.5px solid var(--chatter-black)',
                  boxShadow: '0 0 0 2px var(--chatter-primary)',
                }}
              >
                {profile?.name?.[0]?.toUpperCase() || 'S'}
              </div>
            )}

            {/* Avatar Photo Edit Button */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: 2,
                right: -2,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--chatter-primary)',
                border: '2px solid var(--chatter-black)',
                color: '#0E0E0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
              title="Change Profile Photo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setEditBio(bioText);
                setEditName(displayName || profile?.name || '');
                setEditUsername(displayUsername || profile?.username || '');
                setEditProfileOpen(true);
              }}
              style={{
                padding: '8px 15px',
                borderRadius: 20,
                background: 'rgba(64, 227, 120, 0.12)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Edit Profile
            </button>
            <button
              type="button"
              onClick={onOpenStatusModal}
              style={{
                padding: '8px 15px',
                borderRadius: 20,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Set Status
            </button>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '8px 15px',
                borderRadius: 20,
                background: 'rgba(255, 57, 57, 0.15)',
                border: 'none',
                color: 'var(--chatter-red)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* User Info with Verified Badge (Flutter Chatter Gilroy Standard) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
            {displayName || profile?.name || 'Scholar'}
          </h2>
          <TwitterVerifiedBadge />
        </div>
        <div style={{ fontSize: 14, color: 'var(--chatter-light-text)', marginBottom: 12 }}>
          @{displayUsername || profile?.username || 'scholar'} · {profile?.email}
        </div>

        {/* Bio Section */}
        <div style={{ margin: '0 0 16px 0' }}>
          <p style={{ fontSize: 15, color: '#E5E5E5', lineHeight: 1.55, margin: 0 }}>
            {bioText}
          </p>
        </div>

        {/* ── 3. Flutter Chatter / Twitter Style Inline Stats Row ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px 16px',
            margin: '0 0 20px 0',
            fontSize: 14.5,
            color: 'var(--chatter-light-text)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: '#fff', fontWeight: 800, fontSize: 15.5 }}>{followersCount}</strong>
            <span>Followers</span>
          </div>
          <span style={{ opacity: 0.35 }}>·</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: '#fff', fontWeight: 800, fontSize: 15.5 }}>{followingCount}</strong>
            <span>Following</span>
          </div>
          <span style={{ opacity: 0.35 }}>·</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: 'var(--chatter-primary)', fontWeight: 800, fontSize: 15.5 }}>{studyHours}h</strong>
            <span>Study Hours</span>
          </div>
          <span style={{ opacity: 0.35 }}>·</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <strong style={{ color: '#FEF08A', fontWeight: 800, fontSize: 15.5 }}>{dayStreak}🔥</strong>
            <span>Streak</span>
          </div>
        </div>

        {/* ── 4. Segmented History Tabs ── */}
        <div className="chatter-segment-control" style={{ margin: '0 0 16px 0' }}>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'posts' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            My Posts ({myPosts.length})
          </button>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'notes' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Saved Notes ({savedNotes.length})
          </button>
          <button
            type="button"
            className={`chatter-segment-btn ${activeTab === 'rooms' ? 'chatter-segment-btn--active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            My Rooms ({servers.length})
          </button>
        </div>

        {/* ── 5. Tab Content (Real dynamic items) ── */}
        {/* Tab 1: My Posts */}
        {activeTab === 'posts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingPosts ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)' }}>
                Loading your posts...
              </div>
            ) : myPosts.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--chatter-sheet)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  No study posts published yet
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: 0 }}>
                  Share summaries, lecture questions, or study tips to collaborate with classmates.
                </p>
              </div>
            ) : (
              myPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => onSelectPost?.(post.id)}
                  title="Click to view and discuss on feed"
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--chatter-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="chatter-hashtag">{post.tag}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>{post.timestamp}</span>
                      <span style={{ fontSize: 11, color: 'var(--chatter-primary)', fontWeight: 600 }}>View on Feed ↗</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 15, color: '#E5E5E5', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                    {post.text}
                  </p>
                  {post.attachmentUrl && (
                    <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', maxHeight: 220 }}>
                      <img src={post.attachmentUrl} alt="Post Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--chatter-light-text)' }}>
                    <span>❤️ {post.likes || 0}</span>
                    <span>💬 {post.comments || 0} comments</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Saved Notes (Real user uploaded documents) */}
        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingNotes ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)' }}>
                Loading saved notes...
              </div>
            ) : savedNotes.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--chatter-sheet)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  No saved study documents
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: '0 0 12px 0' }}>
                  Upload lecture notes, slides, or chapters in the AI Guru to index them here.
                </p>
                <button
                  type="button"
                  onClick={onOpenGuru}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 14,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Go to AI Guru
                </button>
              </div>
            ) : (
              savedNotes.map((note) => (
                <div
                  key={note.id || note.doc_id}
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: 'rgba(64, 227, 120, 0.12)',
                        color: 'var(--chatter-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      📄
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.filename || note.title}
                      </h4>
                      <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
                        {note.chunksCount || 1} text chunks · {note.detected_type?.toUpperCase() || 'DOCUMENT'} · Indexed & Ready
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenGuru}
                    style={{
                      padding: '6px 13px',
                      borderRadius: 14,
                      background: 'rgba(64, 227, 120, 0.15)',
                      border: '1px solid var(--chatter-primary)',
                      color: 'var(--chatter-primary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Ask AI
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: My Rooms (Real joined rooms) */}
        {activeTab === 'rooms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servers.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--chatter-sheet)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📚</div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  No study rooms joined
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', margin: 0 }}>
                  Join or create a study group room to start collaborating.
                </p>
              </div>
            ) : (
              servers.map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => onSelectServer?.(srv.id)}
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {srv.icon_url ? (
                      <img
                        src={srv.icon_url}
                        alt={srv.name}
                        style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          background: '#242424',
                          color: 'var(--chatter-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        {srv.name?.[0]?.toUpperCase() || 'S'}
                      </div>
                    )}
                    <div>
                      <h4 style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>
                        {srv.name}
                      </h4>
                      <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                        {srv.channels?.length || 0} channels · {srv.member_count || 1} members
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectServer?.(srv.id);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 14,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Enter Room
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Edit Profile Modal (Triggered by Settings Icon) ── */}
      {editProfileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            background: 'rgba(0,0,0,0.75)',
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
              background: 'var(--chatter-sheet)',
              borderRadius: 22,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
                Edit Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileModal}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 6 }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    color: '#fff',
                    padding: '10px 14px',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Your Name"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 6 }}>
                  Username (@handle)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: 10, color: 'var(--chatter-light-text)', fontSize: 14, fontWeight: 600 }}>@</span>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    style={{
                      width: '100%',
                      background: 'var(--chatter-black)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      color: '#fff',
                      padding: '10px 14px 10px 32px',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    placeholder="username"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--chatter-light-text)', marginBottom: 6 }}>
                  Study Bio & Academic Interests
                </label>
                <textarea
                  rows={4}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--chatter-black)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    color: '#fff',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Share your major, current courses, or study focus..."
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
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
                  disabled={savingProfile}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 14,
                    background: 'var(--chatter-primary)',
                    border: 'none',
                    color: '#0E0E0E',
                    fontSize: 13,
                    fontWeight: 700,
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
    </div>
  );
}
