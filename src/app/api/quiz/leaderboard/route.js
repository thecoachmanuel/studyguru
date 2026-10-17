import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

const DEMO_LEADERBOARD = [
  {
    rank: 1,
    name: 'Sarah Chen',
    username: 'schen_ai',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    score: 2850,
    coins: 1420,
    accuracy: 96,
    badge: '👑 Arena Champion',
  },
  {
    rank: 2,
    name: 'Alex Rivera',
    username: 'arivera_code',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    score: 2430,
    coins: 1190,
    accuracy: 92,
    badge: '🔥 Streak Master',
  },
  {
    rank: 3,
    name: 'Maya Patel',
    username: 'mpatel_bio',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
    score: 2180,
    coins: 980,
    accuracy: 89,
    badge: '🎓 Rising Scholar',
  },
  {
    rank: 4,
    name: 'Jordan Lee',
    username: 'jlee_math',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
    score: 1840,
    coins: 820,
    accuracy: 87,
    badge: '🤖 AI Master',
  },
  {
    rank: 5,
    name: 'David Kim',
    username: 'dkim_phys',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    score: 1620,
    coins: 710,
    accuracy: 85,
    badge: '🎯 Quiz Rookie',
  },
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'global'; // daily | monthly | global

    const db = await getDatabase();
    const users = await db.collection('users')
      .find({ 'quiz_stats.score': { $gt: 0 } })
      .sort({ 'quiz_stats.score': -1 })
      .limit(20)
      .toArray()
      .catch(() => []);

    if (users && users.length >= 3) {
      const formatted = users.map((u, i) => ({
        rank: i + 1,
        name: u.name || u.username || 'Scholar',
        username: u.username || 'scholar',
        avatar: u.avatar_url || u.image || null,
        score: u.quiz_stats?.score || 0,
        coins: u.quiz_stats?.coins || 100,
        accuracy: u.quiz_stats?.accuracy || 80,
        badge: u.quiz_stats?.score > 2000 ? '👑 Arena Champion' : '🎓 Rising Scholar',
      }));

      return NextResponse.json({
        period,
        top3: formatted.slice(0, 3),
        leaderboard: formatted,
      });
    }

    return NextResponse.json({
      period,
      top3: DEMO_LEADERBOARD.slice(0, 3),
      leaderboard: DEMO_LEADERBOARD,
    });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return NextResponse.json({
      period: 'global',
      top3: DEMO_LEADERBOARD.slice(0, 3),
      leaderboard: DEMO_LEADERBOARD,
    });
  }
}
