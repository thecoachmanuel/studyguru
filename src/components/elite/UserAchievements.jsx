'use client';

/**
 * Exact replica of Elite Quiz's UserAchievements widget
 * (lib/ui/screens/home/widgets/user_achievements.dart)
 */
export default function UserAchievements({
  userRank = '1',
  userCoins = '100',
  userScore = '0',
}) {
  return (
    <div
      style={{
        margin: '0 16px',
        backgroundColor: 'var(--primary-color)',
        borderRadius: 12,
        padding: '18px 12px',
        boxShadow: '0 6px 20px rgba(239, 83, 136, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        color: '#ffffff',
      }}
    >
      {/* Rank */}
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
          Rank
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          #{userRank}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1.5,
          height: 38,
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          borderRadius: 2,
        }}
      />

      {/* Coins */}
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
          Coins
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {userCoins}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1.5,
          height: 38,
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          borderRadius: 2,
        }}
      />

      {/* Score */}
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
          Score
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {userScore}
        </div>
      </div>
    </div>
  );
}
