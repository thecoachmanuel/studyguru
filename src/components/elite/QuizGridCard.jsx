'use client';

import EliteIcon from '@/components/elite/EliteIcon';

/**
 * Exact replica of Elite Quiz's QuizGridCard widget
 * (lib/ui/screens/home/widgets/quiz_grid_card.dart)
 */
export default function QuizGridCard({
  title,
  desc,
  iconName,
  tag,
  onTap,
  badge,
}) {
  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onTap?.();
      }}
      style={{
        backgroundColor: 'var(--card)',
        borderRadius: 12,
        padding: 14,
        border: '1px solid var(--border)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 128,
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 83, 136, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.04)';
      }}
    >
      {/* Top text block */}
      <div>
        {tag && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--primary-color)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            {tag}
          </div>
        )}
        <h4
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: '0 0 3px 0',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h4>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {desc}
        </p>
      </div>

      {/* Bottom row: optional badge on left + Icon on bottom right */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
        {badge ? (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 6,
              backgroundColor: 'var(--accent-subtle)',
              color: 'var(--primary-color)',
            }}
          >
            {badge}
          </span>
        ) : <div />}

        {/* Icon container with border matching Elite Quiz */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--background)',
          }}
        >
          <EliteIcon name={iconName} size={22} color="var(--primary-color)" />
        </div>
      </div>
    </div>
  );
}
