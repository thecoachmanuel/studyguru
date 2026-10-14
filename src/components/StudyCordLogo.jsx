'use client';

import React from 'react';
import Link from 'next/link';

export default function StudyCordLogo({
  fontSize = 28,
  dotSize,
  gap,
  href,
  style = {},
  className = '',
}) {
  const calculatedDotSize = dotSize !== undefined ? dotSize : (fontSize >= 28 ? 8 : fontSize >= 22 ? 7 : 6);
  const calculatedGap = gap !== undefined ? gap : (fontSize >= 28 ? 7 : 6);

  const logoMarkup = (
    <div
      className={`chatter-logo-tag ${className}`.trim()}
      style={{
        fontSize,
        gap: calculatedGap,
        userSelect: 'none',
        ...style,
      }}
    >
      <span>
        Study<span style={{ color: 'var(--chatter-primary)' }}>Cord</span>
      </span>
      <span
        className="chatter-logo-tag__dot"
        style={{
          width: calculatedDotSize,
          height: calculatedDotSize,
        }}
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
        {logoMarkup}
      </Link>
    );
  }

  return logoMarkup;
}

// Backward compatibility alias
export { StudyCordLogo as StudyGuruLogo };
