'use client';

import EliteIcon from '@/components/elite/EliteIcon';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * Exact replica of Elite Quiz's _buildUserProfileHeader
 * (lib/ui/screens/home/home_screen.dart:1041)
 */
export default function EliteUserHeader({
  user,
  profile,
  onOpenNotifications,
  onOpenCoinStore,
  unreadNotifications = 0,
}) {
  const displayName = profile?.name || user?.name || 'Scholar';
  const avatarUrl = profile?.avatar_url || user?.image;

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        borderBottom: '1px solid var(--border)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Avatar + Name + Let's Play */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '2px solid rgba(69, 83, 109, 0.2)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: 'var(--background)',
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src="/elite_assets/config/profile/1.svg"
              alt="Avatar"
              style={{ width: 34, height: 34 }}
            />
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: '0 0 2px 0',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </h3>
          <p
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1,
            }}
          >
            Let&apos;s Play
          </p>
        </div>
      </div>

      {/* Right: Actions (Theme Toggle, Notifications, Coin Store) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ThemeToggle />

        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="Notifications"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--primary-color)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: '0 2px 8px rgba(239, 83, 136, 0.3)',
          }}
        >
          <EliteIcon name="notification" size={18} color="#ffffff" />
          {unreadNotifications > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--accent-amber)',
                boxShadow: '0 0 0 2px var(--card)',
              }}
            />
          )}
        </button>

        {/* Coin Store Button */}
        <button
          type="button"
          onClick={onOpenCoinStore}
          aria-label="Coin Store"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--primary-color)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(239, 83, 136, 0.3)',
          }}
        >
          <EliteIcon name="coin" size={18} color="#ffffff" />
        </button>
      </div>
    </div>
  );
}
