'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/context/ThemeContext';

export default function Providers({ children }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
