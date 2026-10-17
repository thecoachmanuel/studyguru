'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EliteIcon from '@/components/elite/EliteIcon';

const COIN_PACKS = [
  { id: 'coins_500', coins: 500, price: '$0.99', popular: false, bonus: '' },
  { id: 'coins_1200', coins: 1200, price: '$1.99', popular: false, bonus: '+20% Extra' },
  { id: 'coins_3000', coins: 3000, price: '$4.99', popular: true, bonus: '+35% Extra' },
  { id: 'coins_7500', coins: 7500, price: '$9.99', popular: false, bonus: '+50% Extra' },
  { id: 'coins_20000', coins: 20000, price: '$24.99', popular: false, bonus: 'Best Value (+70%)' },
];

export default function CoinStorePage() {
  const router = useRouter();
  const [coins, setCoins] = useState(150);
  const [purchasingId, setPurchasingId] = useState(null);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/quiz/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats?.coins !== undefined) setCoins(d.stats.coins);
      })
      .catch(() => {});
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePurchase = async (pack) => {
    setPurchasingId(pack.id);
    setTimeout(async () => {
      const newTotal = coins + pack.coins;
      setCoins(newTotal);
      setPurchasingId(null);
      showToast(`🎉 Successfully added +${pack.coins} Coins!`);

      try {
        await fetch('/api/quiz/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coinsEarned: pack.coins }),
        });
      } catch (_) {}
    }, 900);
  };

  const handleDailyClaim = async () => {
    if (dailyClaimed) return;
    setDailyClaimed(true);
    const newTotal = coins + 25;
    setCoins(newTotal);
    showToast('🎁 Claimed +25 Daily Free Coins!');

    try {
      await fetch('/api/quiz/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinsEarned: 25 }),
      });
    } catch (_) {}
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
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary-color)',
            color: '#fff',
            padding: '10px 22px',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 800,
            boxShadow: '0 8px 24px rgba(239, 83, 136, 0.4)',
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      )}

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
            Coin Store
          </h1>
        </div>

        {/* Current Coin Balance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 14px',
            borderRadius: 20,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#f59e0b',
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          <img src="/elite_assets/images/coin.svg" alt="Coins" style={{ width: 18, height: 18 }} />
          <span>{coins}</span>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {/* Daily Free Reward Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 83, 136, 0.16) 0%, rgba(245, 158, 11, 0.12) 100%)',
            border: '1px solid rgba(239, 83, 136, 0.35)',
            borderRadius: 20,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/elite_assets/images/daily_coins.svg"
              alt="Daily Coins"
              style={{ width: 44, height: 44 }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                Free Daily Reward
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Claim 25 bonus coins every 24 hours
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={dailyClaimed}
            onClick={handleDailyClaim}
            style={{
              padding: '9px 18px',
              borderRadius: 14,
              background: dailyClaimed ? 'var(--bg-hover)' : 'var(--primary-color)',
              color: dailyClaimed ? 'var(--text-secondary)' : '#fff',
              border: dailyClaimed ? '1px solid var(--border)' : 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: dailyClaimed ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: dailyClaimed ? 'none' : '0 4px 14px rgba(239, 83, 136, 0.4)',
            }}
          >
            {dailyClaimed ? 'Claimed' : 'Claim +25 🪙'}
          </button>
        </div>

        {/* Coin Packs Grid */}
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
          Purchase Coin Packages
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260, 1fr))', gap: 14 }}>
          {COIN_PACKS.map((pack) => {
            const isPurchasing = purchasingId === pack.id;
            return (
              <div
                key={pack.id}
                style={{
                  background: 'var(--card)',
                  border: pack.popular ? '2px solid var(--primary-color)' : '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '20px 18px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {pack.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -11,
                      background: 'var(--primary-color)',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 900,
                      padding: '3px 12px',
                      borderRadius: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Most Popular
                  </div>
                )}

                <img
                  src="/elite_assets/images/coin.svg"
                  alt="Coins"
                  style={{ width: 48, height: 48, marginBottom: 10 }}
                />

                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {pack.coins.toLocaleString()} Coins
                </div>

                {pack.bonus && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#40E378',
                      marginTop: 3,
                    }}
                  >
                    {pack.bonus}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isPurchasing}
                  onClick={() => handlePurchase(pack)}
                  className="elite-btn-primary"
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '11px',
                    fontSize: 14,
                    borderRadius: 14,
                  }}
                >
                  {isPurchasing ? 'Processing…' : `Buy for ${pack.price}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
