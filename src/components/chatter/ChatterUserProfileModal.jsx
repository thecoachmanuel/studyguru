'use client';

import { useState, useEffect } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

// In-memory cache for scholar profiles to provide 0ms instant display without flicker
const scholarProfileCache = new Map();

export default function ChatterUserProfileModal({
  targetUser,
  currentUserId,
  onClose,
  onStartDM,
  followingMap = {},
  onToggleFollow,
}) {
  const targetId = targetUser?.id || targetUser?._id;
  const cachedScholar = targetId ? scholarProfileCache.get(targetId) : null;

  const [liveUser, setLiveUser] = useState(() => {
    const cached = cachedScholar || {};
    const rawFollowers = typeof targetUser?.followers_count === 'number'
      ? targetUser.followers_count
      : (typeof targetUser?.followersCount === 'number' ? targetUser.followersCount : (typeof cached.followers_count === 'number' ? cached.followers_count : null));
    const rawFollowing = typeof targetUser?.following_count === 'number'
      ? targetUser.following_count
      : (typeof targetUser?.followingCount === 'number' ? targetUser.followingCount : (typeof cached.following_count === 'number' ? cached.following_count : null));
    const rawHours = typeof targetUser?.study_hours === 'number'
      ? targetUser.study_hours
      : (typeof targetUser?.studyHours === 'number' ? targetUser.studyHours : (typeof cached.study_hours === 'number' ? cached.study_hours : null));
    const rawStreak = typeof targetUser?.day_streak === 'number'
      ? targetUser.day_streak
      : (typeof targetUser?.dayStreak === 'number' ? targetUser.dayStreak : (typeof cached.day_streak === 'number' ? cached.day_streak : null));

    return {
      ...(cached || {}),
      ...(targetUser || {}),
      followers_count: rawFollowers,
      following_count: rawFollowing,
      study_hours: rawHours,
      day_streak: rawStreak,
    };
  });

  const hasInitialFollowers = liveUser?.followers_count !== null && liveUser?.followers_count !== undefined;
  const hasInitialHours = liveUser?.study_hours !== null && liveUser?.study_hours !== undefined;
  const hasInitialStreak = liveUser?.day_streak !== null && liveUser?.day_streak !== undefined;
  const [loadingProfile, setLoadingProfile] = useState(!hasInitialFollowers || !hasInitialHours || !hasInitialStreak);

  // Sync when targetUser prop changes
  useEffect(() => {
    if (targetUser) {
      const incomingFollowers = typeof targetUser.followers_count === 'number'
        ? targetUser.followers_count
        : (typeof targetUser.followersCount === 'number' ? targetUser.followersCount : undefined);
      const incomingHours = typeof targetUser.study_hours === 'number'
        ? targetUser.study_hours
        : (typeof targetUser.studyHours === 'number' ? targetUser.studyHours : undefined);
      const incomingStreak = typeof targetUser.day_streak === 'number'
        ? targetUser.day_streak
        : (typeof targetUser.dayStreak === 'number' ? targetUser.dayStreak : undefined);

      setLiveUser((prev) => ({
        ...prev,
        ...targetUser,
        followers_count: incomingFollowers !== undefined ? incomingFollowers : prev.followers_count,
        study_hours: incomingHours !== undefined ? incomingHours : prev.study_hours,
        day_streak: incomingStreak !== undefined ? incomingStreak : prev.day_streak,
      }));

      if (incomingFollowers === undefined || incomingHours === undefined || incomingStreak === undefined) {
        setLoadingProfile(true);
      }
    }
  }, [targetUser]);

  const isSelf = targetUser?.id === currentUserId || targetUser?.id === 'me' || targetUser?.id === 'u-me';

  // Fetch real-time profile data for targetUser so bio, avatar, and stats match their profile exactly
  useEffect(() => {
    if (!targetUser?.id) return;

    let active = true;
    const profileUrl = isSelf ? '/api/user/profile' : `/api/user/profile?userId=${encodeURIComponent(targetUser.id)}`;
    fetch(profileUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && !data.error && data.found !== false) {
          if (targetId) {
            scholarProfileCache.set(targetId, data);
          }
          setLiveUser((prev) => ({
            ...prev,
            ...data,
            name: (data.name && data.name !== 'Scholar') ? data.name : (prev.name || data.name),
            username: (data.username && data.username !== 'scholar') ? data.username : (prev.username || data.username),
            avatar_url: data.avatar_url || prev.avatar_url,
            banner_url: data.banner_url || prev.banner_url,
            bio: data.bio || prev.bio,
            followers_count: typeof data.followers_count === 'number' ? data.followers_count : prev.followers_count,
            following_count: typeof data.following_count === 'number' ? data.following_count : prev.following_count,
            study_hours: typeof data.study_hours === 'number' ? data.study_hours : (prev.study_hours ?? data.study_hours ?? 0),
            day_streak: typeof data.day_streak === 'number' ? data.day_streak : (prev.day_streak ?? data.day_streak ?? 1),
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [targetUser?.id, isSelf, targetId]);

  if (!targetUser) return null;

  const isFollowing = !!followingMap[targetUser?.id];
  const displayFollowers = typeof liveUser?.followers_count === 'number' ? liveUser.followers_count : 0;
  const studyHours = `${liveUser.study_hours ?? 0}h`;
  const dayStreak = `${liveUser.day_streak ?? 1}🔥`;

  const handleToggleFollow = () => {
    const willFollow = !isFollowing;
    setLiveUser((prev) => ({
      ...prev,
      followers_count: Math.max(0, (prev.followers_count || 0) + (willFollow ? 1 : -1)),
    }));
    onToggleFollow?.(targetUser.id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--chatter-sheet)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover banner */}
        <div
          style={{
            height: 110,
            background: liveUser.banner_url
              ? `url(${liveUser.banner_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #183321 0%, #0E0E0E 100%)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              color: '#fff',
              width: 38,
              height: 38,
              fontSize: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '0 20px 20px', position: 'relative', marginTop: -36 }}>
          {/* Avatar + Follow Action */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              {liveUser.avatar_url ? (
                <img
                  src={liveUser.avatar_url}
                  alt={liveUser.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--chatter-sheet)',
                    boxShadow: '0 0 0 2px var(--chatter-primary)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#242424',
                    color: 'var(--chatter-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 24,
                    border: '3px solid var(--chatter-sheet)',
                    boxShadow: '0 0 0 2px var(--chatter-primary)',
                  }}
                >
                  {liveUser.name?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
            </div>

            {/* Chatter Follow Button */}
            {!isSelf && (
              <button
                type="button"
                onClick={handleToggleFollow}
                style={{
                  padding: '8px 22px',
                  borderRadius: 20,
                  background: isFollowing ? 'transparent' : 'var(--chatter-primary)',
                  border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  color: isFollowing ? '#fff' : '#0E0E0E',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
            )}
          </div>

          {/* Name & Bio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
              {liveUser.name}
            </h3>
            <TwitterVerifiedBadge />
          </div>
          <div style={{ fontSize: 14, color: 'var(--chatter-light-text)', marginBottom: 10, fontWeight: 500 }}>
            @{liveUser.username || liveUser.name?.toLowerCase().replace(/\s+/g, '_')}
          </div>

          {loadingProfile && !liveUser.bio ? (
            <div style={{ margin: '0 0 16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 14, width: '92%', borderRadius: 4, background: 'rgba(255, 255, 255, 0.08)', animation: 'pulse 1.2s infinite ease-in-out' }} />
              <div style={{ height: 14, width: '68%', borderRadius: 4, background: 'rgba(255, 255, 255, 0.08)', animation: 'pulse 1.2s infinite ease-in-out' }} />
            </div>
          ) : (
            <p style={{ fontSize: 15.5, color: '#D4D4D4', lineHeight: 1.55, margin: '0 0 16px 0' }}>
              {liveUser.bio || '🎓 Studying and preparing for upcoming semester exams · Sharing notes on mathematics & computer science.'}
            </p>
          )}

          {/* Stats Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {liveUser.followers_count === null || (loadingProfile && !hasInitialFollowers) ? (
                <div style={{ height: 19, width: 34, borderRadius: 5, margin: '0 auto', background: 'rgba(64, 227, 120, 0.2)', animation: 'pulse 1.2s infinite ease-in-out' }} />
              ) : (
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--chatter-primary)' }}>{displayFollowers}</div>
              )}
              <div style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Followers</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {liveUser.study_hours === null || (loadingProfile && !hasInitialHours) ? (
                <div style={{ height: 19, width: 34, borderRadius: 5, margin: '0 auto', background: 'rgba(64, 227, 120, 0.2)', animation: 'pulse 1.2s infinite ease-in-out' }} />
              ) : (
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--chatter-primary)' }}>{studyHours}</div>
              )}
              <div style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Study Hours</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 14, padding: '12px 10px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {liveUser.day_streak === null || (loadingProfile && !hasInitialStreak) ? (
                <div style={{ height: 19, width: 34, borderRadius: 5, margin: '0 auto', background: 'rgba(64, 227, 120, 0.2)', animation: 'pulse 1.2s infinite ease-in-out' }} />
              ) : (
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--chatter-primary)' }}>{dayStreak}</div>
              )}
              <div style={{ fontSize: 13.5, color: 'var(--chatter-light-text)', marginTop: 2, fontWeight: 500 }}>Day Streak</div>
            </div>
          </div>

          {/* Actions: Send DM */}
          {targetUser.id !== currentUserId && (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onStartDM?.(targetUser);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 14,
                background: 'rgba(64, 227, 120, 0.12)',
                border: '1px solid rgba(64, 227, 120, 0.3)',
                color: 'var(--chatter-primary)',
                fontWeight: 700,
                fontSize: 15.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Send Direct Message</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
