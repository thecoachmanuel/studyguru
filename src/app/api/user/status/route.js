import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    return NextResponse.json({
      status: userDoc?.status || {
        state: 'online',
        text: '',
        emoji: '🟢',
      },
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch status' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    let body = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
      } catch {}
    }

    const { state = 'online', text = '', emoji = '🟢' } = body || {};

    const db = await getDatabase();
    const now = new Date();
    const newStatus = {
      state: String(state).trim(),
      text: String(text).slice(0, 80).trim(),
      emoji: String(emoji).slice(0, 10).trim(),
      updated_at: now,
    };

    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      {
        $set: {
          status: newStatus,
          updated_at: now,
        },
      }
    );

    // Broadcast status change
    try {
      const pusher = getPusherServer();
      await pusher.trigger('presence-global', 'user-status-changed', {
        userId,
        status: newStatus,
      });
    } catch (e) {
      console.warn('Pusher status broadcast warning:', e.message);
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error saving user status:', error);
    return NextResponse.json({ error: error.message || 'Failed to save status' }, { status: 500 });
  }
}
