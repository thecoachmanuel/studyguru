'use client';

import { useState, useEffect, useRef } from 'react';

export default function QuizPlayModal({
  isOpen,
  title = 'Quiz Session',
  questions = [],
  onClose,
  onQuizCompleted,
  isAiQuiz = false,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [sharingStory, setSharingStory] = useState(false);
  const [sharedToast, setSharedToast] = useState('');

  // Lifelines
  const [lifeline5050Used, setLifeline5050Used] = useState(false);
  const [lifelineTimerUsed, setLifelineTimerUsed] = useState(false);
  const [lifelineHintUsed, setLifelineHintUsed] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState([]);
  const [audiencePoll, setAudiencePoll] = useState(null);

  const currentQ = questions[currentIndex] || null;

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isCompleted || isAnswered || !currentQ) return;

    if (timeLeft <= 0) {
      // Time up: auto submit wrong answer
      handleSelectOption(-1);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isCompleted, isAnswered, timeLeft, currentQ]);

  // Reset per question
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setTimeLeft(30);
    setShowExplanation(false);
    setHiddenOptions([]);
    setAudiencePoll(null);
  }, [currentIndex]);

  if (!isOpen || !questions || questions.length === 0) return null;

  const totalQuestions = questions.length;

  const handleSelectOption = (optIndex) => {
    if (isAnswered) return;
    setSelectedOption(optIndex);
    setIsAnswered(true);

    const isCorrect = optIndex === currentQ.answer_index || (optIndex >= 0 && currentQ.options[optIndex] === currentQ.answer);

    if (isCorrect) {
      setScore((prev) => prev + 100);
      setCoinsEarned((prev) => prev + 10);
      setCorrectAnswersCount((prev) => prev + 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finish quiz
      setIsCompleted(true);
      const finalScore = score + (selectedOption === currentQ.answer_index ? 100 : 0);
      const finalCoins = coinsEarned + (selectedOption === currentQ.answer_index ? 10 : 0);
      const finalCorrect = correctAnswersCount + (selectedOption === currentQ.answer_index ? 1 : 0);

      try {
        await fetch('/api/quiz/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: finalScore,
            total: totalQuestions,
            coinsEarned: finalCoins,
            correctCount: finalCorrect,
            incorrectCount: totalQuestions - finalCorrect,
            isAiQuiz,
          }),
        });
        onQuizCompleted?.();
      } catch (err) {
        console.warn('Stats save note:', err);
      }
    }
  };

  // 50:50 Lifeline
  const handleUse5050 = () => {
    if (lifeline5050Used || isAnswered || !currentQ) return;
    setLifeline5050Used(true);

    const correctIdx = currentQ.answer_index;
    const wrongIndices = currentQ.options
      .map((_, i) => i)
      .filter((i) => i !== correctIdx);

    // Shuffle and pick 2 to hide
    const toHide = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    setHiddenOptions(toHide);
  };

  // Reset Time Lifeline
  const handleUseTimerReset = () => {
    if (lifelineTimerUsed || isAnswered) return;
    setLifelineTimerUsed(true);
    setTimeLeft(30);
  };

  // Audience Poll / AI Hint
  const handleUseAudiencePoll = () => {
    if (lifelineHintUsed || isAnswered || !currentQ) return;
    setLifelineHintUsed(true);

    const correctIdx = currentQ.answer_index;
    const poll = currentQ.options.map((_, i) => {
      if (i === correctIdx) return Math.floor(Math.random() * 25) + 55; // 55% - 80%
      return Math.floor(Math.random() * 15) + 5;
    });

    // Normalize to 100
    const sum = poll.reduce((a, b) => a + b, 0);
    setAudiencePoll(poll.map((v) => Math.round((v / sum) * 100)));
  };

  // Share to 24h Story
  const handleShareToStory = async () => {
    setSharingStory(true);
    try {
      const accuracy = Math.round((correctAnswersCount / totalQuestions) * 100);
      const storyText = `🎯 Scored ${correctAnswersCount}/${totalQuestions} (${accuracy}%) on ${title}! Can you beat my score? 🏆`;

      await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'studying',
          emoji: '🏆',
          text: storyText,
        }),
      });

      setSharedToast('🎉 Shared to your 24h Story successfully!');
      setTimeout(() => setSharedToast(''), 3500);
    } catch {
      setSharedToast('Failed to share story');
    } finally {
      setSharingStory(false);
    }
  };

  // Share to Community Feed
  const handleShareToFeed = async () => {
    setSharingStory(true);
    try {
      const accuracy = Math.round((correctAnswersCount / totalQuestions) * 100);
      const postText = `🏆 Just completed the **${title}** Quiz Drill in the Quiz Arena!\n\n• Score: **${score} pts**\n• Accuracy: **${accuracy}%** (${correctAnswersCount}/${totalQuestions} correct)\n• Coins Earned: **+${coinsEarned} 🪙**\n\nThink you know your stuff? Jump into the Arena and challenge my score! 🚀`;

      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: postText,
          tag: '#QuizArena',
        }),
      });

      setSharedToast('🚀 Shared to Community Feed!');
      setTimeout(() => setSharedToast(''), 3500);
    } catch {
      setSharedToast('Failed to share to feed');
    } finally {
      setSharingStory(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: 'var(--card)',
          borderRadius: 24,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(197, 100, 187, 0.15)',
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
      >
        {/* Glow Wave Header Accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #c564bb 0%, #40E378 50%, #f59e0b 100%)',
          }}
        />

        {/* Toast Alert */}
        {sharedToast && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#40E378',
              color: '#000',
              padding: '8px 18px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(64, 227, 120, 0.4)',
              zIndex: 100,
            }}
          >
            {sharedToast}
          </div>
        )}

        {/* ════ SCREEN 1: QUIZ PLAYING ════ */}
        {!isCompleted && currentQ && (
          <div>
            {/* Top Info Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              {/* Question Count Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span>Question</span>
                <span style={{ color: '#c564bb', fontWeight: 900 }}>{currentIndex + 1}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>/ {totalQuestions}</span>
              </div>

              {/* Timer Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: timeLeft <= 5 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  border: timeLeft <= 5 ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: timeLeft <= 5 ? '#f87171' : '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  transition: 'all 0.2s ease',
                }}
              >
                <span>⏱️</span>
                <span>{timeLeft}s</span>
              </div>

              {/* Coins & Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  <span>🪙</span>
                  <span>+{coinsEarned}</span>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#fff',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                  }}
                  title="Quit Quiz"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Timer Progress Bar */}
            <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(timeLeft / 30) * 100}%`,
                  background: timeLeft <= 5 ? '#ef4444' : '#c564bb',
                  transition: 'width 1s linear',
                }}
              />
            </div>

            {/* Lifelines Rail */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              <button
                type="button"
                disabled={lifeline5050Used || isAnswered}
                onClick={handleUse5050}
                style={{
                  padding: '6px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: lifeline5050Used ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                  color: lifeline5050Used ? 'rgba(255, 255, 255, 0.25)' : '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: lifeline5050Used || isAnswered ? 'not-allowed' : 'pointer',
                }}
                title="50/50: Remove 2 wrong options"
              >
                ⚖️ 50:50
              </button>

              <button
                type="button"
                disabled={lifelineTimerUsed || isAnswered}
                onClick={handleUseTimerReset}
                style={{
                  padding: '6px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: lifelineTimerUsed ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                  color: lifelineTimerUsed ? 'rgba(255, 255, 255, 0.25)' : '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: lifelineTimerUsed || isAnswered ? 'not-allowed' : 'pointer',
                }}
                title="Reset Timer back to 30s"
              >
                ⏱️ Reset Time
              </button>

              <button
                type="button"
                disabled={lifelineHintUsed || isAnswered}
                onClick={handleUseAudiencePoll}
                style={{
                  padding: '6px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: lifelineHintUsed ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                  color: lifelineHintUsed ? 'rgba(255, 255, 255, 0.25)' : '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: lifelineHintUsed || isAnswered ? 'not-allowed' : 'pointer',
                }}
                title="Audience Poll / AI Consensus"
              >
                📊 Audience Poll
              </button>
            </div>

            {/* Question Text */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.5,
                textAlign: 'center',
                margin: '15px 0 24px',
                color: 'var(--text-primary)',
                minHeight: 54,
              }}
            >
              {currentQ.question}
            </div>

            {/* 4 Options Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, i) => {
                if (hiddenOptions.includes(i)) {
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 14,
                        border: '1px dashed rgba(255, 255, 255, 0.08)',
                        background: 'transparent',
                        opacity: 0.2,
                        fontSize: 14,
                        color: 'rgba(255, 255, 255, 0.3)',
                        userSelect: 'none',
                      }}
                    >
                      Option removed by 50:50
                    </div>
                  );
                }

                const isThisSelected = selectedOption === i;
                const isCorrect = i === currentQ.answer_index || opt === currentQ.answer;

                let btnBg = 'var(--bg-hover)';
                let btnBorder = '1px solid var(--border)';
                let btnColor = 'var(--text-primary)';

                if (isAnswered) {
                  if (isCorrect) {
                    btnBg = 'rgba(64, 227, 120, 0.2)';
                    btnBorder = '1.5px solid #40E378';
                    btnColor = '#40E378';
                  } else if (isThisSelected) {
                    btnBg = 'rgba(239, 68, 68, 0.25)';
                    btnBorder = '1.5px solid #ef4444';
                    btnColor = '#ef4444';
                  }
                }

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(i)}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      borderRadius: 14,
                      background: btnBg,
                      border: btnBorder,
                      color: btnColor,
                      fontSize: 14,
                      fontWeight: 650,
                      textAlign: 'left',
                      cursor: isAnswered ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {audiencePoll && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)' }}>
                          {audiencePoll[i]}%
                        </span>
                      )}
                      {isAnswered && isCorrect && <span style={{ fontSize: 16 }}>✓</span>}
                      {isAnswered && isThisSelected && !isCorrect && <span style={{ fontSize: 16 }}>✕</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Answer Feedback & AI Guru Explanation */}
            {isAnswered && (
              <div style={{ marginTop: 20 }}>
                {/* Explanation Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowExplanation((prev) => !prev)}
                    style={{
                      background: 'rgba(64, 227, 120, 0.12)',
                      border: '1px solid rgba(64, 227, 120, 0.3)',
                      color: '#40E378',
                      padding: '6px 14px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>💡</span>
                    <span>{showExplanation ? 'Hide AI Explanation' : 'Ask AI Guru: Why?'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      background: '#c564bb',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: 16,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(197, 100, 187, 0.4)',
                    }}
                  >
                    {currentIndex < totalQuestions - 1 ? 'Next Question →' : 'View Results 🏆'}
                  </button>
                </div>

                {showExplanation && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(64, 227, 120, 0.2)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: '#e2e8f0',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#40E378', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🎓 AI Guru Concept Breakdown:</span>
                    </div>
                    {currentQ.explanation || 'The correct option directly satisfies the fundamental definitions and empirical criteria of this topic.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ SCREEN 2: QUIZ COMPLETED ════ */}
        {isCompleted && (
          <div style={{ textAlign: 'center', padding: '15px 10px' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', color: '#fff' }}>
              Quiz Completed!
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', margin: '0 0 24px' }}>
              {title}
            </p>

            {/* Score & Coins Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 25 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: '14px 10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Accuracy</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#40E378', marginTop: 4 }}>
                  {Math.round((correctAnswersCount / totalQuestions) * 100)}%
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: '14px 10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Score</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#c564bb', marginTop: 4 }}>
                  {score} pts
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: '14px 10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Coins Earned</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  +{coinsEarned} 🪙
                </div>
              </div>
            </div>

            {/* Guest Scholar Claim Banner */}
            {typeof window !== 'undefined' && (sessionStorage.getItem('studycord_guest') === '1' || localStorage.getItem('studycord_guest') === '1') && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(197, 100, 187, 0.16) 0%, rgba(9, 0, 41, 0.6) 100%)',
                  border: '1px solid rgba(197, 100, 187, 0.35)',
                  borderRadius: 16,
                  padding: '14px 18px',
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13.5, color: '#f3e8f8', fontWeight: 600, marginBottom: 10 }}>
                  🎓 <strong>Great Drill, Guest Scholar!</strong> Sign up to claim your <strong>+{coinsEarned} 🪙 coins</strong> and rank on the global leaderboard!
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.location.href = '/signup';
                  }}
                  className="elite-btn-primary"
                  style={{
                    display: 'inline-flex',
                    width: 'auto',
                    padding: '8px 20px',
                    fontSize: 13,
                    borderRadius: 12,
                    margin: '0 auto',
                  }}
                >
                  Create Account & Save Score
                </button>
              </div>
            )}

            {/* Social Sharing Actions */}
            <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: 16, padding: 16, marginBottom: 25, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                📣 Challenge Your Classmates:
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={sharingStory}
                  onClick={handleShareToStory}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🔥</span>
                  <span>Post to 24h Story</span>
                </button>

                <button
                  type="button"
                  disabled={sharingStory}
                  onClick={handleShareToFeed}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📢</span>
                  <span>Share Win to Feed</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setCurrentIndex(0);
                  setIsCompleted(false);
                  setScore(0);
                  setCoinsEarned(0);
                  setCorrectAnswersCount(0);
                }}
                style={{
                  padding: '10px 22px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔄 Play Again
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  borderRadius: 16,
                  background: '#c564bb',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(197, 100, 187, 0.4)',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
