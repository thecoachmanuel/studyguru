'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import EliteIcon from '@/components/elite/EliteIcon';

const SAMPLE_BOOKMARKS = [
  {
    id: 'b1',
    category: 'Computer Science',
    question: 'Which algorithmic paradigm does Dijkstra’s shortest-path algorithm employ?',
    options: ['Greedy Approach', 'Dynamic Programming', 'Divide and Conquer', 'Backtracking'],
    answer: 'Greedy Approach',
  },
  {
    id: 'b2',
    category: 'Biology',
    question: 'What organelle produces ATP through cellular respiration in eukaryotic cells?',
    options: ['Mitochondria', 'Endoplasmic Reticulum', 'Golgi Apparatus', 'Ribosome'],
    answer: 'Mitochondria',
  },
  {
    id: 'b3',
    category: 'Physics',
    question: 'What is the SI unit of electric capacitance?',
    options: ['Farad', 'Henry', 'Tesla', 'Coulomb'],
    answer: 'Farad',
  },
];

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState(SAMPLE_BOOKMARKS);

  const handleRemove = (id) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
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
            Bookmarked Questions
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="elite-btn-primary"
          style={{
            padding: '7px 16px',
            fontSize: 13,
            borderRadius: 14,
            width: 'auto',
          }}
        >
          Play Bookmarks
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {bookmarks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <img
              src="/elite_assets/images/bookmark.svg"
              alt="No bookmarks"
              style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.4 }}
            />
            <div style={{ fontSize: 16, fontWeight: 800 }}>No Bookmarked Questions</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Tap the bookmark icon during any quiz drill to save tricky questions for later review!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {bookmarks.map((b) => (
              <div
                key={b.id}
                style={{
                  background: 'var(--card)',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  padding: '18px 20px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--primary-color)',
                      background: 'rgba(239, 83, 136, 0.12)',
                      padding: '4px 10px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    {b.category}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemove(b.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: '4px 8px',
                    }}
                    title="Remove Bookmark"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, lineHeight: 1.45 }}>
                  {b.question}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {b.options.map((opt, i) => {
                    const isCorrect = opt === b.answer;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: isCorrect ? 'rgba(64, 227, 120, 0.15)' : 'var(--bg-hover)',
                          border: isCorrect ? '1.5px solid #40E378' : '1px solid var(--border)',
                          color: isCorrect ? '#40E378' : 'var(--text-primary)',
                          fontSize: 13,
                          fontWeight: 650,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
