'use client';

/* eslint-disable no-unused-vars */
import { useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  animate,
  useReducedMotion,
} from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';

const DARK_COLORS = [
  '#000000',
  '#050505',
  '#0a0a0a',
  '#0f0f0f',
];

const LIGHT_COLORS = [
  '#F8FAFC',
  '#F1F5F9',
  '#E2E8F0',
  '#F8FAFC',
];

export default function EtherealBackground({ children }) {
  const { theme } = useTheme();
  const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const color = useMotionValue(colors[0]);
  const bgGradient = useMotionTemplate`radial-gradient(ellipse 100% 80% at 30% 20%, ${color}, transparent)`;
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    color.set(colors[0]);
    if (shouldReduceMotion) {
      return undefined;
    }
    const controls = animate(color, colors, {
      duration: 12,
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'easeInOut',
    });
    return () => controls.stop();
  }, [color, colors, shouldReduceMotion]);

  return (
    <div className="ethereal-wrapper">
      {/* Dark grid pattern */}
      <div className="ethereal-grid" />

      {/* Animated glow */}
      <motion.div className="ethereal-glow" style={{ backgroundImage: bgGradient }} />

      {/* Secondary static glow */}
      <div className="ethereal-glow-secondary" />

      {/* Noise grain */}
      <div className="ethereal-noise" />

      {/* Content */}
      <div className="ethereal-content">
        {children}
      </div>
    </div>
  );
}
