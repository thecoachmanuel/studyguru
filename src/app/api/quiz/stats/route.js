import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({
        stats: {
          coins: 100,
          total_played: 0,
          correct_count: 0,
          incorrect_count: 0,
          score: 0,
          streak: 1,
          accuracy: 0,
          unlocked_badges: ['badge-rookie'],
        },
      });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const quizStats = userDoc?.quiz_stats || {
      coins: 100,
      total_played: 0,
      correct_count: 0,
      incorrect_count: 0,
      score: 0,
      streak: 1,
      accuracy: 0,
      unlocked_badges: ['badge-rookie'],
    };

    return NextResponse.json({ stats: quizStats });
  } catch (err) {
    console.error('Error fetching quiz stats:', err);
    return NextResponse.json({ error: 'Failed to fetch quiz stats' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const {
      score = 0,
      total = 0,
      coinsEarned = 10,
      correctCount = 0,
      incorrectCount = 0,
      isAiQuiz = false,
    } = body;

    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const currentStats = userDoc?.quiz_stats || {
      coins: 100,
      total_played: 0,
      correct_count: 0,
      incorrect_count: 0,
      score: 0,
      streak: 1,
      perfect_scores: 0,
      ai_quizzes_completed: 0,
      unlocked_badges: ['badge-rookie'],
    };

    const newTotalPlayed = (currentStats.total_played || 0) + 1;
    const newCorrect = (currentStats.correct_count || 0) + correctCount;
    const newIncorrect = (currentStats.incorrect_count || 0) + incorrectCount;
    const newCoins = (currentStats.coins || 100) + coinsEarned;
    const newScore = (currentStats.score || 0) + score;
    const isPerfect = total > 0 && correctCount === total;
    const newPerfect = (currentStats.perfect_scores || 0) + (isPerfect ? 1 : 0);
    const newAiCount = (currentStats.ai_quizzes_completed || 0) + (isAiQuiz ? 1 : 0);
    const accuracy = newTotalPlayed > 0 ? Math.round((newCorrect / (newCorrect + newIncorrect || 1)) * 100) : 0;

    // Check badges to unlock
    const unlockedBadges = new Set(currentStats.unlocked_badges || ['badge-rookie']);
    unlockedBadges.add('badge-rookie');
    if (newPerfect >= 3) unlockedBadges.add('badge-scholar');
    if (newCoins >= 500) unlockedBadges.add('badge-champion');
    if (newAiCount >= 5) unlockedBadges.add('badge-ai-guru');

    const updatedStats = {
      coins: newCoins,
      total_played: newTotalPlayed,
      correct_count: newCorrect,
      incorrect_count: newIncorrect,
      score: newScore,
      streak: Math.max(1, currentStats.streak || 1),
      perfect_scores: newPerfect,
      ai_quizzes_completed: newAiCount,
      accuracy,
      unlocked_badges: Array.from(unlockedBadges),
      last_quiz_at: new Date(),
    };

    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      { $set: { quiz_stats: updatedStats } }
    );

    return NextResponse.json({ success: true, stats: updatedStats });
  } catch (err) {
    console.error('Error updating quiz stats:', err);
    return NextResponse.json({ error: 'Failed to update quiz stats' }, { status: 500 });
  }
}
