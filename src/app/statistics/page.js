'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EliteIcon from '@/components/elite/EliteIcon';

export default function StatisticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    coins: 100,
    total_played: 12,
    score: 850,
    streak: 3,
    accuracy: 82,
    correct_count: 36,
    incorrect_count: 8,
    battles_won: 4,
    battles_lost: 1,
  });

  useEffect(() => {
    fetch('/api/quiz/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats) {
          setStats((prev) => ({ ...prev, ...d.stats }));
        }
      })
      .catch(() => {});
  }, []);

  const totalQuestions = (stats.correct_count || 0) + (stats.incorrect_count || 0) || 44;
  const correctCount = stats.correct_count || 36;
  const incorrectCount = stats.incorrect_count || 8;
  const accuracyPct = Math.round((correctCount / totalQuestions) * 100) || 82;

  const battlesTotal = (stats.battles_won || 4) + (stats.battles_lost || 1);
  const winRate = Math.round(((stats.battles_won || 4) / battlesTotal) * 100);

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
            Statistics
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push('/badges')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          View Badges →
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {/* Top 3 Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              padding: '16px 12px',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Rank
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
              #12
            </div>
          </div>

          <div
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              padding: '16px 12px',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Coins
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
              {stats.coins || 100} 🪙
            </div>
          </div>

          <div
            style={{
              background: 'var(--card)',
              borderRadius: 20,
              padding: '16px 12px',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Score
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary-color)', marginTop: 4 }}>
              {stats.score || 850}
            </div>
          </div>
        </div>

        {/* Question Performance Details Card */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 22,
            border: '1px solid var(--border)',
            padding: '22px 20px',
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            Question Accuracy
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Visual Circular Gauge */}
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: `conic-gradient(#40E378 0% ${accuracyPct}%, rgba(239, 68, 68, 0.4) ${accuracyPct}% 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: '50%',
                  background: 'var(--card)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {accuracyPct}%
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Accuracy
                </div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#40E378' }} />
                  <span>Correct Answers</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#40E378' }}>{correctCount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                  <span>Incorrect Answers</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{incorrectCount}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary-color)' }} />
                  <span>Total Answered</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{totalQuestions}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Battle Duel Statistics */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 22,
            border: '1px solid var(--border)',
            padding: '22px 20px',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>
            1v1 Battle Record
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                background: 'var(--bg-hover)',
                borderRadius: 16,
                padding: '14px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                Battles
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
                {battlesTotal}
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-hover)',
                borderRadius: 16,
                padding: '14px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                Wins
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#40E378', marginTop: 4 }}>
                {stats.battles_won || 4}
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-hover)',
                borderRadius: 16,
                padding: '14px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>
                Win Rate
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--primary-color)', marginTop: 4 }}>
                {winRate}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
