'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const BADGES = [
  {
    id: 'badge-rookie',
    name: 'Rookie Scholar',
    desc: 'Completed your first quiz session',
    reward: '20 Coins',
    icon: '🌱',
    req: 'Complete 1 quiz',
    total: 1,
  },
  {
    id: 'badge-streak-3',
    name: 'Consistent Scholar',
    desc: 'Maintained an active study streak',
    reward: '50 Coins',
    icon: '🔥',
    req: 'Maintain 3-day streak',
    total: 3,
  },
  {
    id: 'badge-quiz-champ',
    name: 'Quiz Titan',
    desc: 'Answered 25 questions accurately in the arena',
    reward: '100 Coins',
    icon: '🎯',
    req: 'Answer 25 questions correctly',
    total: 25,
  },
  {
    id: 'badge-fast-thinker',
    name: 'Fast Thinker',
    desc: 'Answered questions within 5 seconds',
    reward: '75 Coins',
    icon: '⚡',
    req: '5 quick correct answers',
    total: 5,
  },
  {
    id: 'badge-guru-ally',
    name: 'AI Apprentice',
    desc: 'Breakdown complex topics with AI Guru',
    reward: '60 Coins',
    icon: '🤖',
    req: 'Ask AI Guru 3 questions',
    total: 3,
  },
  {
    id: 'badge-centurion',
    name: 'Coin Centurion',
    desc: 'Accumulate 500+ study coins',
    reward: '150 Coins',
    icon: '🪙',
    req: 'Hold 500 total coins',
    total: 500,
  },
  {
    id: 'badge-duel-master',
    name: 'Duel Master',
    desc: 'Won live 1v1 battle matches',
    reward: '200 Coins',
    icon: '⚔️',
    req: 'Win 5 1v1 Battles',
    total: 5,
  },
  {
    id: 'badge-top-scholar',
    name: 'Podium Leader',
    desc: 'Rank in top 3 on the global leaderboard',
    reward: '300 Coins',
    icon: '👑',
    req: 'Achieve Rank 1, 2, or 3',
    total: 1,
  },
];

export default function BadgesPage() {
  const router = useRouter();
  const [unlockedBadges, setUnlockedBadges] = useState(['badge-rookie']);
  const [selectedBadge, setSelectedBadge] = useState(null);

  useEffect(() => {
    fetch('/api/quiz/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats?.unlocked_badges) {
          setUnlockedBadges(d.stats.unlocked_badges);
        }
      })
      .catch(() => {});
  }, []);

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
            Badges & Rewards
          </h1>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--primary-color)',
            padding: '5px 12px',
            borderRadius: 16,
            background: 'rgba(239, 83, 136, 0.12)',
            border: '1px solid rgba(239, 83, 136, 0.3)',
          }}
        >
          {unlockedBadges.length} / {BADGES.length} Unlocked
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Complete quizzes, climb leaderboards, and practice daily to earn exclusive badge honors and bonus coins!
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 14 }}>
          {BADGES.map((b) => {
            const isUnlocked = unlockedBadges.includes(b.id);
            return (
              <div
                key={b.id}
                onClick={() => setSelectedBadge(b)}
                style={{
                  background: 'var(--card)',
                  borderRadius: 20,
                  border: isUnlocked ? '1.5px solid var(--primary-color)' : '1px solid var(--border)',
                  padding: '20px 12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  opacity: isUnlocked ? 1 : 0.45,
                  filter: isUnlocked ? 'none' : 'grayscale(1)',
                  boxShadow: isUnlocked ? '0 6px 20px rgba(239, 83, 136, 0.18)' : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: isUnlocked ? 'rgba(239, 83, 136, 0.15)' : 'var(--bg-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                    marginBottom: 10,
                  }}
                >
                  {b.icon}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: isUnlocked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.25,
                    marginBottom: 4,
                  }}
                >
                  {b.name}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isUnlocked ? '#40E378' : 'var(--text-secondary)',
                  }}
                >
                  {isUnlocked ? 'Unlocked' : 'Locked'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge Details Modal */}
      {selectedBadge && (
        <div
          onClick={() => setSelectedBadge(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--card)',
              borderRadius: 24,
              border: '1px solid var(--border)',
              padding: '28px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(239, 83, 136, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                margin: '0 auto 16px',
              }}
            >
              {selectedBadge.icon}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              {selectedBadge.name}
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
              {selectedBadge.desc}
            </p>

            <div
              style={{
                background: 'var(--bg-hover)',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 20,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Requirement:
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedBadge.req}
              </div>
              <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 800, marginTop: 8 }}>
                Reward: +{selectedBadge.reward}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="elite-btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: 14,
                borderRadius: 14,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
