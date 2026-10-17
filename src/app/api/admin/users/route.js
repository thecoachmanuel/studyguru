import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDatabase();
    const users = await db.collection('users').find({}).limit(50).toArray().catch(() => []);

    const formatted = users.map((u) => ({
      id: u._id ? u._id.toString() : u.id,
      name: u.name || u.username || 'Scholar',
      email: u.email || 'student@studycord.me',
      role: u.role || 'student',
      coins: u.quiz_stats?.coins || 100,
      score: u.quiz_stats?.score || 0,
      total_played: u.quiz_stats?.total_played || 0,
      accuracy: u.quiz_stats?.accuracy || 0,
      streak: u.quiz_stats?.streak || 1,
      created_at: u.created_at || u.createdAt || new Date(),
    }));

    return NextResponse.json({ success: true, users: formatted });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, role, coinsAdjustment } = body;
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const update = {};
    if (role) {
      update.role = role;
    }
    if (typeof coinsAdjustment === 'number') {
      update['quiz_stats.coins'] = coinsAdjustment;
    }

    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      { $set: update }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating user:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
