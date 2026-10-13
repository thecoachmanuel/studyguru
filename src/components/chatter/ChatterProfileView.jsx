'use client';

import { useState, useRef, useEffect } from 'react';
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
}) {
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'notes' | 'rooms'
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bioText, setBioText] = useState('📚 Studying Computer Science & Machine Learning · Always open to collaborate on projects & exam drills!');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [followersCount, setFollowersCount] = useState(14);
  const [toastMessage, setToastMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const followingCount = Object.values(followingMap).filter(Boolean).length;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  // Load persistent user profile from MongoDB
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
            if (data.bio) setBioText(data.bio);
            if (typeof data.followers_count === 'number') setFollowersCount(data.followers_count);
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

      showToast('Profile photo saved!');
    } catch (err) {
      console.warn('Avatar upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result);
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

      showToast('Cover banner saved!');
    } catch (err) {
      console.warn('Banner upload fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setBannerUrl(reader.result);
        showToast('Cover banner updated!');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioText.trim() }),
      });
      showToast('Bio updated successfully!');
      setIsEditingBio(false);
    } catch (err) {
      showToast('Failed to save bio');
    } finally {
      setSavingBio(false);
    }
  };

  // User's own study posts
  const [myPosts, setMyPosts] = useState([
    {
      id: 'my-p1',
      tag: '#ComputerScience',
      text: 'Just finished indexing the chapter on Graph Theory & Dijkstra. Notes are available in the repository!',
      timestamp: 'Today at 10:15',
      likes: 18,
      comments: 4,
    },
    {
      id: 'my-p2',
      tag: '#MachineLearning',
      text: 'Backpropagation derivation cheat sheet uploaded. Focus on the chain rule steps for layer weights.',
      timestamp: 'Oct 11',
      likes: 31,
      comments: 9,
    },
  ]);

  // Saved / Bookmarked Study Notes
  const savedNotes = [
    {
      id: 'note-1',
      title: 'Data Structures & Algorithms Comprehensive Guide.pdf',
      subject: 'Computer Science',
      size: '4.2 MB',
      pages: '64 pages',
      date: 'Added Oct 10',
    },
    {
      id: 'note-2',
      title: 'Calculus III Vector Calculus & Stokes Theorem Notes.pdf',
      subject: 'Mathematics',
      size: '2.8 MB',
      pages: '38 pages',
      date: 'Added Oct 08',
    },
    {
      id: 'note-3',
      title: 'Organic Chemistry Reactions Summary & Mechanisms.pdf',
      subject: 'Biology & Chemistry',
      size: '5.1 MB',
      pages: '52 pages',
      date: 'Added Oct 04',
    },
  ];

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

      {/* ── 1. Cover Banner with Edit Trigger ── */}
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

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Settings"
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
          {/* Avatar with Emerald Ring & Camera Trigger */}
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

        {/* User Info with Verified Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
            {profile?.name || 'Scholar'}
          </h2>
          <TwitterVerifiedBadge />
        </div>
        <div style={{ fontSize: 13, color: 'var(--chatter-light-text)', marginBottom: 8 }}>
          @{profile?.username || 'scholar'} · {profile?.email}
        </div>

        {/* Bio Section with Edit capability */}
        {isEditingBio ? (
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--chatter-primary)',
                borderRadius: 12,
                color: '#fff',
                padding: '10px 12px',
                fontSize: 13.5,
                lineHeight: 1.5,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              placeholder="Write your study bio, major, or research interests..."
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleSaveBio}
                disabled={savingBio}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: savingBio ? 'not-allowed' : 'pointer',
                }}
              >
                {savingBio ? 'Saving...' : 'Save Bio'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBio(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, margin: '0 0 16px 0' }}>
            <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: 0, flex: 1 }}>
              {bioText}
            </p>
            <button
              type="button"
              onClick={() => setIsEditingBio(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'var(--chatter-light-text)',
                fontSize: 11.5,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ✏️ Edit
            </button>
          </div>
        )}

        {/* ── 3. Study Stats Grid with Followers and Following ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>14</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Notes Shared</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>7🔥</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Day Streak</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>{followersCount}</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Followers</div>
          </div>
          <div style={{ background: 'var(--chatter-sheet)', borderRadius: 14, padding: '12px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--chatter-primary)' }}>{followingCount}</div>
            <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Following</div>
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

        {/* ── 5. Tab Content ── */}
        {/* Tab 1: My Posts */}
        {activeTab === 'posts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  background: 'var(--chatter-sheet)',
                  borderRadius: 16,
                  padding: 14,
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="chatter-hashtag">{post.tag}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>{post.timestamp}</span>
                </div>
                <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 10px 0' }}>
                  {post.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--chatter-light-text)' }}>
                  <span>❤️ {post.likes}</span>
                  <span>💬 {post.comments} comments</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Saved Notes */}
        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedNotes.map((note) => (
              <div
                key={note.id}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    }}
                  >
                    📄
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 3px 0' }}>
                      {note.title}
                    </h4>
                    <div style={{ fontSize: 11.5, color: 'var(--chatter-light-text)' }}>
                      #{note.subject} · {note.size} · {note.pages} · {note.date}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    showToast('Opening document with StudyGuru AI...');
                    onOpenGuru?.();
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 14,
                    background: 'rgba(64, 227, 120, 0.12)',
                    border: '1px solid rgba(64, 227, 120, 0.3)',
                    color: 'var(--chatter-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ask AI
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: My Rooms */}
        {activeTab === 'rooms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {servers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--chatter-light-text)', background: 'var(--chatter-sheet)', borderRadius: 16 }}>
                You have not joined any study rooms yet.
              </div>
            ) : (
              servers.map((server) => (
                <div
                  key={server.id}
                  style={{
                    background: 'var(--chatter-sheet)',
                    borderRadius: 16,
                    padding: 14,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: '#242424',
                        color: 'var(--chatter-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {server.name?.[0]?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>
                        {server.name}
                      </h4>
                      <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                        {server.channels?.length || 0} channels · {server.member_count || 1} members
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectServer?.(server.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 14,
                      background: 'var(--chatter-primary)',
                      border: 'none',
                      color: '#0E0E0E',
                      fontSize: 12,
                      fontWeight: 700,
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
    </div>
  );
}
