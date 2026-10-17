'use client';

import { useState, useEffect } from 'react';
import QuizPlayModal from '@/components/quiz/QuizPlayModal';

export default function ChatterQuizArenaView({ user, onBack, onOpenGuru }) {
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    coins: 100,
    total_played: 0,
    score: 0,
    streak: 1,
    accuracy: 0,
    unlocked_badges: ['badge-rookie'],
  });
  const [leaderboard, setLeaderboard] = useState([]);

  // Active playing quiz session
  const [activeQuizSession, setActiveQuizSession] = useState(null); // { title, questions, isAiQuiz }
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  // Self Challenge Modal
  const [selfChallengeOpen, setSelfChallengeOpen] = useState(false);
  const [scCategory, setScCategory] = useState('all');
  const [scCount, setScCount] = useState(5);

  // AI Note-to-Quiz modal
  const [aiQuizModalOpen, setAiQuizModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSelectedDocId, setAiSelectedDocId] = useState('');
  const [generatingAiQuiz, setGeneratingAiQuiz] = useState(false);

  const [loading, setLoading] = useState(true);

  // Fetch initial data
  const loadArenaData = async () => {
    try {
      const [catsRes, statsRes, lbRes, docsRes] = await Promise.all([
        fetch('/api/quiz/categories').then((r) => r.json()),
        fetch('/api/quiz/stats').then((r) => r.json()),
        fetch('/api/quiz/leaderboard').then((r) => r.json()),
        fetch('/api/rag/documents').then((r) => r.json()).catch(() => ({ documents: [] })),
      ]);

      if (Array.isArray(catsRes?.categories)) setCategories(catsRes.categories);
      if (statsRes?.stats) setStats(statsRes.stats);
      if (Array.isArray(lbRes?.leaderboard)) setLeaderboard(lbRes.leaderboard);
      if (Array.isArray(docsRes?.documents)) setDocuments(docsRes.documents);
    } catch (err) {
      console.warn('Quiz Arena load notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArenaData();
  }, []);

  // Launch Category Quiz
  const handleLaunchCategoryQuiz = async (cat) => {
    try {
      const res = await fetch(`/api/quiz/questions?category_id=${cat.id || cat._id}&limit=8&random=true`);
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveQuizSession({
          title: `${cat.name} Quiz`,
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      } else {
        alert('No questions available in this category yet.');
      }
    } catch {
      alert('Failed to load quiz questions.');
    }
  };

  // Launch Self-Challenge
  const handleStartSelfChallenge = async () => {
    try {
      const params = new URLSearchParams({ limit: scCount, random: 'true' });
      if (scCategory !== 'all') params.set('category_id', scCategory);

      const res = await fetch(`/api/quiz/questions?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setSelfChallengeOpen(false);
        setActiveQuizSession({
          title: `Self-Challenge (${scCount} Questions)`,
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Failed to launch challenge.');
    }
  };

  // Generate & Launch AI Quiz
  const handleStartAiQuiz = async () => {
    if (!aiTopic.trim() && !aiSelectedDocId) {
      alert('Please select a document or type a topic.');
      return;
    }

    setGeneratingAiQuiz(true);
    try {
      const res = await fetch('/api/quiz/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          documentId: aiSelectedDocId || null,
          count: 5,
        }),
      });

      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setAiQuizModalOpen(false);
        setActiveQuizSession({
          title: `AI Quiz: ${data.title || aiTopic}`,
          questions: data.questions,
          isAiQuiz: true,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Error synthesizing AI quiz with Gemini.');
    } finally {
      setGeneratingAiQuiz(false);
    }
  };

  // Daily Quiz
  const handleStartDailyQuiz = async () => {
    try {
      const res = await fetch('/api/quiz/questions?limit=5&random=true');
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        setActiveQuizSession({
          title: 'Daily Streak Quiz Challenge 🔥',
          questions: data.questions,
          isAiQuiz: false,
        });
        setIsQuizModalOpen(true);
      }
    } catch {
      alert('Error loading daily quiz.');
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100dvh',
        overflowY: 'auto',
        background: '#090029',
        color: '#fff',
        fontFamily: 'Lato, -apple-system, sans-serif',
        padding: '20px 24px 80px',
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* ── Top Header & Stats Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🏆</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px' }}>
              Quiz <span style={{ color: '#c564bb' }}>Arena</span>
            </h1>
            <span style={{ background: 'rgba(197, 100, 187, 0.2)', border: '1px solid rgba(197, 100, 187, 0.4)', color: '#c564bb', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
              Elite Engine v2
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
            Gamified drills, AI note-to-quiz challenges, and global student leaderboards
          </p>
        </div>

        {/* 4 Stat Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
            <span>🪙</span>
            <span>{stats.coins || 100} Coins</span>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#f87171' }}>
            <span>🔥</span>
            <span>{stats.streak || 1} Day Streak</span>
          </div>

          <div style={{ background: 'rgba(64, 227, 120, 0.15)', border: '1px solid rgba(64, 227, 120, 0.35)', padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#40E378' }}>
            <span>🎯</span>
            <span>{stats.accuracy || 85}% Accuracy</span>
          </div>
        </div>
      </div>

      {/* ── 3 Hero Action Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
        {/* 1. AI Note-to-Quiz Card */}
        <div
          onClick={() => setAiQuizModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(197, 100, 187, 0.25) 0%, rgba(103, 119, 239, 0.2) 100%)',
            border: '1px solid rgba(197, 100, 187, 0.45)',
            borderRadius: 20,
            padding: 22,
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>✨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#fff' }}>
                AI Note-to-Quiz
              </h3>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#c564bb' }}>POWERED BY GEMINI</span>
            </div>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4 }}>
            Instantly convert your study documents, PDFs, or any chapter topic into an interactive quiz!
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#c564bb' }}>
            <span>Synthesize Quiz with AI</span>
            <span>→</span>
          </div>
        </div>

        {/* 2. Self Challenge Card */}
        <div
          onClick={() => setSelfChallengeOpen(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(14, 165, 233, 0.2) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            borderRadius: 20,
            padding: 22,
            cursor: 'pointer',
            transition: 'transform 0.18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>⏱️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#fff' }}>
                Self-Challenge
              </h3>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>CUSTOM SPEED DRILL</span>
            </div>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4 }}>
            Select your target subject, question count, and test your exam readiness under the clock.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#60a5fa' }}>
            <span>Configure Challenge</span>
            <span>→</span>
          </div>
        </div>

        {/* 3. Daily Streak Challenge */}
        <div
          onClick={handleStartDailyQuiz}
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.2) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            borderRadius: 20,
            padding: 22,
            cursor: 'pointer',
            transition: 'transform 0.18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>🔥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#fff' }}>
                Daily Streak Quiz
              </h3>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>+50 BONUS COINS</span>
            </div>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.4 }}>
            5 fresh questions daily to protect your study streak and earn double coin rewards.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>
            <span>Play Daily Quiz</span>
            <span>→</span>
          </div>
        </div>
      </div>

      {/* ── Quiz Zone: Categories ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
              🎯 Quiz Zone Categories
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
              Master topics level by level and climb the global scholar ranks
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {categories.map((cat) => (
            <div
              key={cat.id || cat._id}
              onClick={() => handleLaunchCategoryQuiz(cat)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 18,
                padding: '20px 18px',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(197, 100, 187, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{cat.image || '📚'}</span>
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, color: 'rgba(255, 255, 255, 0.6)' }}>
                    {cat.question_count || 12} Questions
                  </span>
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  {cat.name}
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.4 }}>
                  {cat.description || 'Practice core academic concepts'}
                </p>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#c564bb', fontWeight: 800 }}>Play Quiz Zone</span>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#c564bb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  ▶
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Global Leaderboard Podium ── */}
      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 22, padding: '24px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              🏆 Scholar Leaderboard
            </h3>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>Top scoring scholars across all quiz categories</span>
          </div>
          <span style={{ background: 'rgba(64, 227, 120, 0.12)', color: '#40E378', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
            Active Season
          </span>
        </div>

        {/* Top 3 Podium */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          {leaderboard.slice(0, 3).map((s, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            const medalColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#b45309';

            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: 16,
                  border: `1px solid ${medalColor}40`,
                  padding: 16,
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{medal}</div>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: medalColor, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 16 }}>
                  {s.name?.charAt(0) || 'S'}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#c564bb', fontWeight: 800, marginTop: 4 }}>
                  {s.score} pts • {s.coins} 🪙
                </div>
              </div>
            );
          })}
        </div>

        {/* 4th+ list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaderboard.slice(3, 6).map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', width: 20 }}>
                  #{idx + 4}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                {s.score} pts
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL: Self-Challenge ── */}
      {selfChallengeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 450, background: '#120738', borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.15)', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>🎯 Configure Self-Challenge</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 6 }}>
                Subject / Category:
              </label>
              <select
                value={scCategory}
                onChange={(e) => setScCategory(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: 13 }}
              >
                <option value="all" style={{ background: '#120738' }}>All Academic Subjects</option>
                {categories.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id} style={{ background: '#120738' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 6 }}>
                Number of Questions:
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[5, 10, 15].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setScCount(cnt)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 12,
                      border: scCount === cnt ? '1px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: scCount === cnt ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      color: scCount === cnt ? '#60a5fa' : '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {cnt} Questions
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSelfChallengeOpen(false)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartSelfChallenge}
                style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Start Challenge ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AI Note-to-Quiz ── */}
      {aiQuizModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#120738', borderRadius: 20, border: '1px solid rgba(197, 100, 187, 0.35)', padding: 24 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#fff' }}>✨ AI Note-to-Quiz Generator</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              Synthesize 5 custom quiz questions grounded in your uploaded study notes or any lecture topic.
            </p>

            {documents.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 6 }}>
                  Select from your AI Guru Study Documents:
                </label>
                <select
                  value={aiSelectedDocId}
                  onChange={(e) => setAiSelectedDocId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: 13 }}
                >
                  <option value="" style={{ background: '#120738' }}>-- Enter custom topic instead --</option>
                  {documents.map((d) => (
                    <option key={d.doc_id || d._id} value={d.doc_id || d._id} style={{ background: '#120738' }}>
                      📄 {d.filename || d.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 6 }}>
                Or enter any custom topic/concept:
              </label>
              <input
                type="text"
                placeholder="e.g. Backpropagation, Photosynthesis, French Revolution..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setAiQuizModalOpen(false)}
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generatingAiQuiz}
                onClick={handleStartAiQuiz}
                style={{
                  background: generatingAiQuiz ? '#666' : 'linear-gradient(135deg, #c564bb 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '10px 22px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: generatingAiQuiz ? 'wait' : 'pointer',
                  boxShadow: '0 4px 15px rgba(197, 100, 187, 0.4)',
                }}
              >
                {generatingAiQuiz ? 'Synthesizing...' : '⚡ Generate & Play Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Quiz Gameplay Modal ── */}
      {isQuizModalOpen && activeQuizSession && (
        <QuizPlayModal
          isOpen={isQuizModalOpen}
          title={activeQuizSession.title}
          questions={activeQuizSession.questions}
          isAiQuiz={activeQuizSession.isAiQuiz}
          onClose={() => setIsQuizModalOpen(false)}
          onQuizCompleted={loadArenaData}
        />
      )}
    </div>
  );
}
