'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReferAndEarnPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const referCode = 'STUDY-GURU-894';

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(referCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = () => {
    if (navigator?.share) {
      navigator.share({
        title: 'Join StudyGuru Quiz Arena',
        text: `Use my invite code ${referCode} to get 100 free bonus coins on StudyGuru!`,
        url: typeof window !== 'undefined' ? window.location.origin : '',
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--page-background)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Top Curved Primary Header */}
      <div
        style={{
          background: 'var(--primary-color)',
          color: '#fff',
          padding: '24px 20px 48px',
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          position: 'relative',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(239, 83, 136, 0.3)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: 12,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ←
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '8px 0 16px' }}>
          Refer & Earn Coins
        </h1>

        <img
          src="/elite_assets/images/refer_earn.svg"
          alt="Refer and Earn"
          style={{ width: 140, height: 140, margin: '0 auto 12px', display: 'block' }}
        />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 32, fontWeight: 900 }}>
          <img src="/elite_assets/images/coin.svg" alt="Coin" style={{ width: 32, height: 32 }} />
          <span>+50</span>
        </div>
        <p style={{ fontSize: 13.5, opacity: 0.9, margin: '4px 0 0' }}>
          Earn 50 coins for every classmate who registers with your code!
        </p>
      </div>

      {/* Floating Card Content */}
      <div
        style={{
          maxWidth: 440,
          margin: '-24px auto 0',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 24,
            border: '1px solid var(--border)',
            padding: '28px 24px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Your Referral Code
          </div>

          <div
            style={{
              padding: '14px',
              border: '2px dashed var(--primary-color)',
              borderRadius: 16,
              background: 'rgba(239, 83, 136, 0.06)',
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 2,
              color: 'var(--primary-color)',
              marginBottom: 20,
              userSelect: 'all',
            }}
          >
            {referCode}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 14,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied' : 'Copy Code'}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="elite-btn-primary"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 14,
                fontSize: 14,
              }}
            >
              Share Invite
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 24, padding: '0 8px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
            How it works
          </h3>
          <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
            <li>Share your unique code with classmates & study partners.</li>
            <li>Your friends receive 100 free welcome coins upon registration.</li>
            <li>You receive 50 bonus coins directly to your wallet instantly!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
