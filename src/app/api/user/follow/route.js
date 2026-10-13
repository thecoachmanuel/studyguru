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
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      return NextResponse.json({ following: [], followers: [] });
    }

    const followingRecords = await db.collection('follows')
      .find({ follower_id: userId })
      .toArray();

    const followerRecords = await db.collection('follows')
      .find({ following_id: userId })
      .toArray();

    return NextResponse.json({
      following: followingRecords.map((r) => String(r.following_id)),
      followers: followerRecords.map((r) => String(r.follower_id)),
    });
  } catch (error) {
    console.error('Error fetching followings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch follows' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const { target_user_id } = body;

    if (!target_user_id || target_user_id === userId) {
      return NextResponse.json({ error: 'Valid target_user_id is required' }, { status: 400 });
    }

    let db = null;
    try {
      db = await getDatabase();
    } catch {
      return NextResponse.json({ success: true, is_following: true, target_user_id });
    }

    const existing = await db.collection('follows').findOne({
      follower_id: userId,
      following_id: target_user_id,
    });

    let isFollowing = false;

    if (existing) {
      // Unfollow
      await db.collection('follows').deleteOne({
        _id: existing._id,
      });

      // Decrement counts
      await db.collection('users').updateOne(
        { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
        { $inc: { following_count: -1 } }
      );
      await db.collection('users').updateOne(
        { $or: [{ _id: safeObjectId(target_user_id) }, { id: target_user_id }] },
        { $inc: { followers_count: -1 } }
      );
      isFollowing = false;
    } else {
      // Follow
      await db.collection('follows').insertOne({
        follower_id: userId,
        following_id: target_user_id,
        created_at: new Date(),
      });

      // Increment counts
      await db.collection('users').updateOne(
        { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
        { $inc: { following_count: 1 } }
      );
      await db.collection('users').updateOne(
        { $or: [{ _id: safeObjectId(target_user_id) }, { id: target_user_id }] },
        { $inc: { followers_count: 1 } }
      );
      isFollowing = true;
    }

    // Real-time Pusher Notification
    try {
      const pusher = getPusherServer();
      if (pusher) {
        const payload = {
          follower_id: userId,
          follower_name: session.user.name || 'Scholar',
          following_id: target_user_id,
          is_following: isFollowing,
          timestamp: new Date().toISOString(),
        };
        await pusher.trigger(`user-${target_user_id}`, 'follow-changed', payload);
        await pusher.trigger(`user-${userId}`, 'follow-changed', payload);
      }
    } catch (e) {
      console.warn('Pusher follow notice warning:', e.message);
    }

    return NextResponse.json({
      success: true,
      is_following: isFollowing,
      target_user_id,
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    return NextResponse.json({ error: error.message || 'Failed to toggle follow' }, { status: 500 });
  }
}
