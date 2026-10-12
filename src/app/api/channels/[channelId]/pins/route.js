import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    let db;
    try {
      db = await getDatabase();
    } catch {
      return NextResponse.json([]);
    }

    const pinnedMessages = await db.collection('messages')
      .find({ channel_id: channelId, is_pinned: true, deleted_at: null })
      .sort({ pinned_at: -1 })
      .toArray();

    // Fetch authors
    const userIds = [...new Set(pinnedMessages.map((m) => m.user_id))];
    const userQueryIds = userIds.map((id) => safeObjectId(id));

    const users = await db.collection('users')
      .find({
        $or: [
          { _id: { $in: userQueryIds } },
          { id: { $in: userIds } },
        ],
      })
      .toArray();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(u._id.toString(), u);
      if (u.id) userMap.set(String(u.id), u);
    });

    const formatted = pinnedMessages.map(msg => {
      const author = userMap.get(msg.user_id);
      return {
        id: msg._id.toString(),
        message_id: msg._id.toString(),
        channel_id: msg.channel_id,
        user_id: msg.user_id,
        content: msg.content,
        attachments: msg.attachments || [],
        attachment: msg.attachments?.[0] || null,
        is_pinned: true,
        pinned_at: msg.pinned_at,
        created_at: msg.created_at,
        author_username: author?.username || author?.name || 'User',
        author_avatar_url: author?.avatar_url || author?.image || null,
        profiles: {
          id: msg.user_id,
          username: author?.username || author?.name || 'User',
          name: author?.name || author?.username || 'User',
          avatar_url: author?.avatar_url || author?.image || null,
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching pinned messages:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch pins' }, { status: 500 });
  }
}
