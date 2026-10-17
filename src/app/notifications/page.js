'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import EliteIcon from '@/components/elite/EliteIcon';

const SAMPLE_NOTIFICATIONS = [
  {
    id: 'n1',
    title: '🔥 Daily Arena Quiz is Live!',
    message: 'Test your knowledge with today’s freshly generated drill questions and claim +50 bonus coins.',
    date: 'Just now',
    type: 'quiz_zone',
    unread: true,
  },
  {
    id: 'n2',
    title: '⚔️ 1v1 Battle Challenge',
    message: 'A new opponent is searching for a live duel. Enter the Battle of the Day and win +100 coins!',
    date: '2 hours ago',
    type: 'battle',
    unread: true,
  },
  {
    id: 'n3',
    title: '🏆 Weekly Leaderboard Reset',
    message: 'Leaderboards have updated! Check your standing and climb back to the top of the podium.',
    date: 'Yesterday',
    type: 'leaderboard',
    unread: false,
  },
  {
    id: 'n4',
    title: '🎁 Welcome Bonus Claimed',
    message: 'You have been awarded 100 starter coins to use for lifelines, duels, and exclusive badges.',
    date: '3 days ago',
    type: 'wallet',
    unread: false,
  },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-background)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
        paddingBottom: 40,
      }}
    >
      {/* Top App Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            Notifications
          </h1>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <img
              src="/elite_assets/images/notification_icon.svg"
              alt="No notifications"
              style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.4 }}
            />
            <div style={{ fontSize: 16, fontWeight: 800 }}>No Notifications Yet</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>We’ll notify you when new quizzes, duels, or rewards go live!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: 'var(--card)',
                  borderRadius: 18,
                  border: n.unread ? '1.5px solid var(--primary-color)' : '1px solid var(--border)',
                  padding: '16px 18px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  position: 'relative',
                  boxShadow: n.unread ? '0 4px 16px rgba(239, 83, 136, 0.12)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'rgba(239, 83, 136, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <EliteIcon name="notification" size={20} color="var(--primary-color)" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {n.date}
                    </span>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {n.message}
                  </p>

                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--primary-color)',
                      cursor: 'pointer',
                    }}
                  >
                    Play Now →
                  </button>
                </div>

                {n.unread && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--primary-color)',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
