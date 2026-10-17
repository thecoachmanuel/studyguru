'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function GuestAuthModal({
  isOpen,
  onClose,
  feature = 'use this feature',
}) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          color: 'var(--text-primary)',
          position: 'relative',
          fontFamily: 'var(--font-family)',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Illustration (Elite Quiz login_acc.svg) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <img
            src="/elite_assets/images/login_acc.svg"
            alt="Login Required"
            style={{ width: 110, height: 110, objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '20px',
            fontWeight: '800',
            margin: '0 0 10px 0',
            color: 'var(--primary-color)',
          }}
        >
          Login Required
        </h3>

        {/* Message */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: '0 0 24px 0',
          }}
        >
          Please login to {feature}, accumulate coins, and climb the scholar leaderboard!
        </p>

        {/* Buttons (Exact QDialog layout: Cancel & Confirm) */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Maybe Later
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/login');
            }}
            className="elite-btn-primary"
            style={{
              flex: 1,
              height: 44,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
