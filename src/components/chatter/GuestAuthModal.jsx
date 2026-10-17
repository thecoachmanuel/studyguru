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
        backgroundColor: 'rgba(9, 0, 41, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(180deg, #180d38 0%, #0e0624 100%)',
          border: '1px solid rgba(197, 100, 187, 0.35)',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(197, 100, 187, 0.2)',
          color: '#ffffff',
          position: 'relative',
          fontFamily: 'var(--font-family)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close 'X' Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: '#bbb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'background 0.15s ease',
          }}
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Modal Badge & Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(197, 100, 187, 0.25) 0%, rgba(64, 227, 120, 0.2) 100%)',
              border: '1px solid rgba(197, 100, 187, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(197, 100, 187, 0.25)',
            }}
          >
            🏆
          </div>

          <h2
            style={{
              fontSize: '24px',
              fontWeight: '800',
              margin: '0 0 8px 0',
              fontFamily: 'var(--font-heading)',
              color: '#ffffff',
            }}
          >
            Sign In Required
          </h2>
          <p
            style={{
              fontSize: '14.5px',
              color: '#a5a1b5',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            You are currently exploring in <strong>Guest Mode</strong>. To {feature}, save your quiz coins, and earn badges, please sign in or register a scholar profile.
          </p>
        </div>

        {/* Feature List */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '13.5px',
            color: '#d6d3e3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🎖️</span>
            <span>Accumulate quiz coins & climb the global scholar leaderboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>💬</span>
            <span>Publish campus thoughts, questions, and join discussions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🎙️</span>
            <span>Join live peer voice spaces & AI study groups</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/login');
            }}
            className="elite-btn-primary"
            style={{
              width: '100%',
              padding: '13px',
              fontSize: '15.5px',
              fontWeight: '800',
            }}
          >
            Sign In to StudyCord
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/signup');
            }}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            Create New Account
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8e8a9f',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '6px',
              marginTop: '4px',
              transition: 'color 0.15s ease',
            }}
          >
            Continue Browsing as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
