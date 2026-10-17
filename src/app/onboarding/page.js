'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SLIDES = [
  {
    image: '/elite_assets/images/onboarding_a.svg',
    title: 'Compete With Friends',
    desc: 'Battle live in 1v1 duels, join group quiz rooms, and challenge classmates across a wide range of academic topics.',
  },
  {
    image: '/elite_assets/images/onboarding_b.svg',
    title: 'Play Quiz & Earn Coins',
    desc: 'Earn daily bonus coins, unlock achievement badges, and put your skills to the test in 13 interactive quiz game modes.',
  },
  {
    image: '/elite_assets/images/onboarding_c.svg',
    title: 'Climb The Leaderboard',
    desc: 'Rise up the ranks on daily, monthly, and all-time leaderboards to become the undisputed champion of the Quiz Arena.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [slideIndex, setSlideIndex] = useState(0);

  const handleNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex((prev) => prev + 1);
    } else {
      router.push('/login');
    }
  };

  const handleSkip = () => {
    router.push('/login');
  };

  const currentSlide = SLIDES[slideIndex];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '28px 24px 36px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Top Bar with Skip */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={handleSkip}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 12,
            transition: 'color 0.2s ease',
          }}
        >
          Skip
        </button>
      </div>

      {/* Main Slide Content */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          margin: 'auto 0',
        }}
      >
        {/* Illustration */}
        <div
          style={{
            width: '100%',
            maxWidth: 320,
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
          }}
        >
          <img
            src={currentSlide.image}
            alt={currentSlide.title}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25))',
              transition: 'transform 0.3s ease',
            }}
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: 'var(--text-primary)',
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          {currentSlide.title}
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: 340,
            margin: '0 auto',
          }}
        >
          {currentSlide.desc}
        </p>

        {/* Indicator Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 32,
          }}
        >
          {SLIDES.map((_, i) => (
            <span
              key={i}
              onClick={() => setSlideIndex(i)}
              style={{
                height: 8,
                width: slideIndex === i ? 26 : 8,
                borderRadius: 4,
                backgroundColor:
                  slideIndex === i ? 'var(--primary-color)' : 'rgba(239, 83, 136, 0.25)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={handleNext}
          className="elite-btn-primary"
          style={{
            padding: '14px 24px',
            fontSize: 15,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(239, 83, 136, 0.35)',
          }}
        >
          {slideIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link
              href="/login"
              style={{
                color: 'var(--primary-color)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
