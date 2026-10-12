'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  // Default to 'light' as primary theme
  const [theme, setThemeState] = useState('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('studycord-theme');
      // If user has an explicit preference, use it; otherwise default to 'light'
      const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
      setThemeState(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);
    } catch {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    setMounted(true);
  }, []);

  const setTheme = (newTheme) => {
    const validTheme = newTheme === 'dark' ? 'dark' : 'light';
    setThemeState(validTheme);
    try {
      localStorage.setItem('studycord-theme', validTheme);
      document.documentElement.setAttribute('data-theme', validTheme);
    } catch {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
