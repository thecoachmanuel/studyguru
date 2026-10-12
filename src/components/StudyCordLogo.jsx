'use client';

import React from 'react';
import StudyGuruLogo from './StudyGuruLogo';

// Backward-compatible wrapper for StudyGuruLogo
export default function StudyCordLogo(props) {
  return <StudyGuruLogo {...props} />;
}

export { StudyGuruLogo };
