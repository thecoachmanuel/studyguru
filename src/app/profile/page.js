'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect cleanly to Chatter Profile tab in the unified dashboard
    router.replace('/dashboard?tab=profile');
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#0E0E0E',
        color: '#40E378',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>🎓</div>
        <div style={{ fontSize: 14, color: '#979797' }}>Loading StudyCord Profile...</div>
      </div>
    </div>
  );
}
