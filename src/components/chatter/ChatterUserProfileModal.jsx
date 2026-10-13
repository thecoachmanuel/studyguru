'use client';

import { useState } from 'react';
import { TwitterVerifiedBadge } from './ChatterFeedView';

export default function ChatterUserProfileModal({
  targetUser,
  currentUserId,
  onClose,
  onStartDM,
  followingMap = {},
  onToggleFollow,
}) {
  if (!targetUser) return null;

  const isFollowing = !!followingMap[targetUser?.id];
  const baseFollowers = targetUser?.followersCount || 28;
  const followersCount = baseFollowers + (isFollowing ? 1 : 0);

  const handleToggleFollow = () => {
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
            background: 'linear-gradient(135deg, #183321 0%, #0E0E0E 100%)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
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
              {targetUser.avatar_url ? (
                <img
                  src={targetUser.avatar_url}
                  alt={targetUser.name}
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
                  {targetUser.name?.[0]?.toUpperCase() || 'S'}
                </div>
              )}
            </div>

            {/* Chatter Follow Button */}
            {targetUser.id !== currentUserId && (
              <button
                type="button"
                onClick={handleToggleFollow}
                style={{
                  padding: '8px 20px',
                  borderRadius: 20,
                  background: isFollowing ? 'transparent' : 'var(--chatter-primary)',
                  border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  color: isFollowing ? '#fff' : '#0E0E0E',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isFollowing ? '✓ Following' : '+ Follow'}
              </button>
            )}
          </div>

          {/* Name & Bio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
              {targetUser.name}
            </h3>
            <TwitterVerifiedBadge />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--chatter-light-text)', marginBottom: 8 }}>
            @{targetUser.username || targetUser.name?.toLowerCase().replace(/\s+/g, '_')}
          </div>

          <p style={{ fontSize: 13.5, color: '#D4D4D4', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            {targetUser.bio || '🎓 Studying and preparing for upcoming semester exams · Sharing notes on mathematics & computer science.'}
          </p>

          {/* Stats Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <div style={{ background: '#141414', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--chatter-primary)' }}>{followersCount}</div>
              <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Followers</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--chatter-primary)' }}>34h</div>
              <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Study Hours</div>
            </div>
            <div style={{ background: '#141414', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--chatter-primary)' }}>5🔥</div>
              <div style={{ fontSize: 11, color: 'var(--chatter-light-text)' }}>Day Streak</div>
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
                fontSize: 14,
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
