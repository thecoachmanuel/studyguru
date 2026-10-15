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

    const conversations = await db.collection('conversations')
      .find({ participants: userId })
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray();

    // Collect all recipient user IDs
    const otherUserIds = [];
    conversations.forEach((c) => {
      const other = c.participants.find((p) => p !== userId);
      if (other) otherUserIds.push(other);
    });

    const userObjIds = otherUserIds.map((id) => safeObjectId(id));
    const users = await db.collection('users')
      .find({
        $or: [{ _id: { $in: userObjIds } }, { id: { $in: otherUserIds } }],
      })
      .toArray();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(u._id.toString(), u);
      if (u.id) userMap.set(String(u.id), u);
    });

    // Calculate unread count for each conversation
    const convIds = conversations.map((c) => c._id.toString());
    let unreadMap = new Map();
    try {
      const unreadAgg = await db.collection('messages').aggregate([
        {
          $match: {
            conversation_id: { $in: convIds },
            user_id: { $ne: userId },
            $or: [{ is_read: { $ne: true } }, { is_read: null }],
            deleted_at: null,
          },
        },
        {
          $group: {
            _id: '$conversation_id',
            count: { $sum: 1 },
          },
        },
      ]).toArray();
      unreadAgg.forEach((item) => unreadMap.set(String(item._id), item.count));
    } catch {}

    // Touch caller's last_seen timestamp
    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      { $set: { last_seen: new Date() } }
    ).catch(() => {});

    const formatted = conversations.map((c) => {
      const otherId = c.participants.find((p) => p !== userId);
      const otherUser = userMap.get(otherId);
      const convId = c._id.toString();

      const lastSeenDate = otherUser?.last_seen || otherUser?.status?.updated_at || otherUser?.updatedAt || null;
      const isOnline = lastSeenDate
        ? (Date.now() - new Date(lastSeenDate).getTime()) < 5 * 60 * 1000
        : false;

      return {
        id: convId,
        participants: c.participants,
        status: c.status || 'accepted',
        requested_by: c.requested_by || null,
        last_message: c.last_message || null,
        unread_count: unreadMap.get(convId) || 0,
        updated_at: c.updated_at,
        other_user: {
          id: otherId,
          username: otherUser?.username || otherUser?.name || 'Study Partner',
          name: otherUser?.name || otherUser?.username || 'Study Partner',
          avatar_url: otherUser?.avatar_url || otherUser?.image || null,
          online: isOnline,
          last_seen: lastSeenDate,
          status: {
            state: isOnline ? 'online' : 'offline',
            text: otherUser?.status?.text || '',
            emoji: otherUser?.status?.emoji || (isOnline ? '🟢' : '⚪'),
            last_seen: lastSeenDate,
          },
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch conversations' }, { status: 500 });
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

    const { recipient_id } = body || {};
    if (!recipient_id || recipient_id === userId) {
      return NextResponse.json({ error: 'Valid recipient ID is required' }, { status: 400 });
    }

    const db = await getDatabase();

    // Check if conversation already exists between these 2 users
    let conv = await db.collection('conversations').findOne({
      participants: { $all: [userId, recipient_id], $size: 2 },
    });

    const now = new Date();
    if (!conv) {
      const newConv = {
        participants: [userId, recipient_id],
        type: 'direct',
        status: 'pending',
        requested_by: userId,
        last_message: null,
        created_at: now,
        updated_at: now,
      };
      const res = await db.collection('conversations').insertOne(newConv);
      conv = { ...newConv, _id: res.insertedId };
    }

    // Get recipient info
    const recipient = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(recipient_id) }, { id: recipient_id }],
    });

    // Notify recipient in real-time
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`user-${recipient_id}`, 'new-conversation', {
          id: conv._id.toString(),
          requested_by: userId,
          status: conv.status,
        });
      }
    } catch (e) {
      console.warn('Pusher new-conversation notification notice:', e.message);
    }

    return NextResponse.json({
      id: conv._id.toString(),
      participants: conv.participants,
      status: conv.status || 'accepted',
      requested_by: conv.requested_by || null,
      last_message: conv.last_message,
      updated_at: conv.updated_at,
      other_user: {
        id: recipient_id,
        username: recipient?.username || recipient?.name || 'Study Partner',
        name: recipient?.name || recipient?.username || 'Study Partner',
        avatar_url: recipient?.avatar_url || recipient?.image || null,
        status: recipient?.status || { state: 'offline' },
      },
    });
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize chat' }, { status: 500 });
  }
}
