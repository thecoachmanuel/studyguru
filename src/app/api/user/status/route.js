import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

function formatTimeAgo(date) {
  if (!date) return 'Recently';
  const diffMinutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const isFeed = searchParams.get('feed') === 'true' || searchParams.get('all') === 'true';

    const db = await getDatabase();
    const now = new Date();
    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      { $set: { last_seen: now } }
    ).catch(() => {});

    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rawStatus = userDoc?.status || {};
    const isStatusExpired = rawStatus.updated_at && new Date(rawStatus.updated_at).getTime() < twentyFourHoursAgo.getTime();
    const myStatus = {
      state: rawStatus.state || 'online',
      text: isStatusExpired ? '' : (rawStatus.text || ''),
      emoji: isStatusExpired ? '🟢' : (rawStatus.emoji || '🟢'),
    };

    if (!isFeed) {
      return NextResponse.json({ status: myStatus });
    }

    // Query current user's follows
    const follows = await db.collection('follows').find({ follower_id: userId }).toArray().catch(() => []);
    const followingIds = new Set(follows.map((f) => String(f.following_id)));

    // Query active status notes set by community users within the last 24 hours
    const usersWithStatus = await db.collection('users')
      .find({
        $and: [
          { 'status.text': { $exists: true, $ne: '' } },
          { 'status.updated_at': { $gte: twentyFourHoursAgo } },
          { _id: { $ne: safeObjectId(userId) } },
          { id: { $ne: userId } },
        ],
      })
      .sort({ 'status.updated_at': -1 })
      .limit(30)
      .toArray()
      .catch(() => []);

    const communityNotes = usersWithStatus.map((u) => {
      const uId = u._id ? u._id.toString() : u.id;
      return {
        id: `note-${uId}`,
        author: {
          id: uId,
          name: u.name || 'Scholar',
          username: u.username || 'scholar',
          avatar_url: u.avatar_url || u.image || null,
        },
        text: u.status.text,
        emoji: u.status.emoji || '📚',
        timestamp: formatTimeAgo(u.status.updated_at || u.updated_at),
        is_following: followingIds.has(String(uId)),
      };
    });

    return NextResponse.json({
      status: myStatus,
      notes: communityNotes,
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
          last_seen: now,
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
