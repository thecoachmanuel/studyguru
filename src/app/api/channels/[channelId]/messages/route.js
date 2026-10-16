import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId, ObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // Offline / demo mode
    }

    if (!db) {
      return NextResponse.json([
        {
          id: 'demo-msg-1',
          channel_id: channelId,
          user_id: 'user-tutor',
          content: 'Welcome to StudyGuru! 🎓 This is your collaborative study space with real-time text, voice, video, and AI study tools.',
          attachments: [],
          is_pinned: true,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          profiles: {
            id: 'user-tutor',
            username: 'StudyGuru Tutor',
            name: 'StudyGuru Tutor',
            avatar_url: null,
          },
        },
        {
          id: 'demo-msg-2',
          channel_id: channelId,
          user_id: session.user.id,
          content: 'Hello everyone! Excited to study together and use the AI study tools.',
          attachments: [],
          is_pinned: false,
          created_at: new Date(Date.now() - 1800000).toISOString(),
          profiles: {
            id: session.user.id,
            username: session.user.name || 'Demo Student',
            name: session.user.name || 'Demo Student',
            avatar_url: session.user.image || null,
          },
        },
      ]);
    }

    // Fetch messages (excluding soft-deleted ones or returning with deleted flag)
    const messages = await db.collection('messages')
      .find({ channel_id: channelId, deleted_at: null })
      .sort({ created_at: 1 })
      .limit(100)
      .toArray();

    // Fetch authors
    const userIds = [...new Set(messages.map((m) => m.user_id))];
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

    const formattedMessages = messages.map(msg => {
      const author = userMap.get(msg.user_id);
      const isRead = Boolean(
        msg.is_read ||
        msg.read_at ||
        (Array.isArray(msg.read_by) && msg.read_by.length > 0)
      );
      return {
        id: msg._id.toString(),
        channel_id: msg.channel_id,
        user_id: msg.user_id,
        content: msg.content,
        attachments: msg.attachments || [],
        reactions: msg.reactions || [],
        is_pinned: !!msg.is_pinned,
        is_read: isRead,
        created_at: msg.created_at,
        profiles: {
          id: msg.user_id,
          username: author?.username || author?.name || 'User',
          name: author?.name || author?.username || 'User',
          avatar_url: author?.avatar_url || author?.image || null,
        },
      };
    });

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        if (text && text !== '[object Object]') {
          body = JSON.parse(text);
        }
      } catch {}
    }

    const { content = '', attachments = [] } = body || {};

    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: 'Message content or attachment is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const now = new Date();

    const formattedAttachments = (attachments || []).map((att) => ({
      id: att.id || (att._id ? att._id.toString() : new ObjectId().toString()),
      file_name: att.file_name || att.name || 'attachment',
      file_url: att.file_url || att.url || '',
      file_type: att.file_type || att.type || '',
      file_size: att.file_size || att.size || 0,
      resource_id: att.resource_id || null,
      storage_path: att.storage_path || null,
    }));

    const newMessage = {
      channel_id: channelId,
      user_id: userId,
      content: content ? content.trim() : '',
      attachments: formattedAttachments,
      reactions: [],
      is_pinned: false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    const res = await db.collection('messages').insertOne(newMessage);
    const messageId = res.insertedId.toString();

    // Fetch author profile
    let author = null;
    try {
      const queryUserId = safeObjectId(userId);
      author = await db.collection('users').findOne({
        $or: [{ _id: queryUserId }, { id: userId }],
      });
    } catch {
      author = await db.collection('users').findOne({ email: session.user.email });
    }

    const messagePayload = {
      id: messageId,
      channel_id: channelId,
      user_id: userId,
      content: newMessage.content,
      attachments: newMessage.attachments,
      reactions: [],
      is_pinned: false,
      created_at: now,
      profiles: {
        id: userId,
        username: author?.username || session.user.name || 'User',
        name: author?.name || session.user.name || 'User',
        avatar_url: author?.avatar_url || session.user.image || null,
      },
    };

    // Sender automatically marks their own channel as read up to this moment
    try {
      await db.collection('channel_reads').updateOne(
        { user_id: userId, channel_id: channelId },
        {
          $set: {
            user_id: userId,
            channel_id: channelId,
            last_read_at: now,
            updated_at: now,
          },
        },
        { upsert: true }
      );
    } catch {}

    // Broadcast in real-time over Pusher
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`channel-${channelId}`, 'new-message', messagePayload);

      // Also broadcast to the server channel so all members get instant unread updates
      let serverId = null;
      try {
        const chDoc = await db.collection('channels').findOne({
          $or: [
            { _id: safeObjectId(channelId) },
            { id: channelId },
          ],
        });
        if (chDoc?.server_id) {
          serverId = String(chDoc.server_id);
        }
      } catch {}

      if (serverId) {
        await pusher.trigger(`server-${serverId}`, 'server-new-message', {
          channelId,
          messageId,
          userId,
          createdAt: now.toISOString(),
        });
      }
    } catch (e) {
      console.warn('Pusher broadcast error:', e.message);
    }

    return NextResponse.json(messagePayload, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
