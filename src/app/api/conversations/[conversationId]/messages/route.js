import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();

    const convObjId = safeObjectId(conversationId);
    let conv = await db.collection('conversations').findOne({
      $or: [
        { _id: convObjId },
        { id: conversationId },
        { participants: { $all: [userId, conversationId] } },
      ],
      participants: userId,
    });

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 });
    }

    const realConvId = conv._id.toString();

    // Mark unread messages sent by peer as read
    const unreadUpdate = await db.collection('messages').updateMany(
      {
        conversation_id: conversationId,
        user_id: { $ne: userId },
        $or: [{ is_read: { $ne: true } }, { is_read: null }],
      },
      {
        $set: { is_read: true, read_at: new Date() },
      }
    );

    if (unreadUpdate.modifiedCount > 0) {
      try {
        const pusher = getPusherServer();
        if (pusher) {
          await pusher.trigger(`conversation-${conversationId}`, 'messages-read', {
            conversationId,
            readBy: userId,
            readAt: new Date().toISOString(),
          });
        }
      } catch (pushErr) {}
    }

    const messages = await db.collection('messages')
      .find({
        conversation_id: conversationId,
        deleted_at: null,
      })
      .sort({ created_at: 1 })
      .limit(100)
      .toArray();

    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const userQueryIds = userIds.map((id) => safeObjectId(id));

    const authors = await db.collection('users')
      .find({
        $or: [{ _id: { $in: userQueryIds } }, { id: { $in: userIds } }],
      })
      .toArray();

    const authorMap = new Map();
    authors.forEach((u) => {
      authorMap.set(u._id.toString(), u);
      if (u.id) authorMap.set(String(u.id), u);
    });

    const formatted = messages.map((m) => {
      const author = authorMap.get(m.user_id);
      return {
        id: m._id.toString(),
        conversation_id: conversationId,
        user_id: m.user_id,
        content: m.content,
        attachment_url: m.attachment_url || null,
        reactions: m.reactions || [],
        is_read: Boolean(m.is_read || m.read_at),
        created_at: m.created_at,
        profiles: {
          id: m.user_id,
          username: author?.username || author?.name || 'User',
          name: author?.name || author?.username || 'User',
          avatar_url: author?.avatar_url || author?.image || null,
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
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

    const { content = '', attachment_url = null } = body || {};
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const convObjId = safeObjectId(conversationId);
    let conv = await db.collection('conversations').findOne({
      $or: [
        { _id: convObjId },
        { id: conversationId },
        { participants: { $all: [userId, conversationId] } },
      ],
      participants: userId,
    });

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 });
    }

    const actualConversationId = conv._id.toString();

    // Check message request state
    if (conv.status === 'pending') {
      if (conv.requested_by === userId) {
        // Check if user has already sent an initial message request
        const existingCount = await db.collection('messages').countDocuments({
          conversation_id: conversationId,
          user_id: userId,
        });
        if (existingCount >= 1) {
          return NextResponse.json({
            error: 'Message request sent. Please wait for the recipient to accept your request before sending more messages.',
            isRequestPending: true,
          }, { status: 403 });
        }
      } else {
        // The recipient is replying, auto-accept the conversation!
        await db.collection('conversations').updateOne(
          { $or: [{ _id: convObjId }, { id: conversationId }] },
          { $set: { status: 'accepted', updated_at: new Date() } }
        );
      }
    }

    const now = new Date();
    const newMessage = {
      conversation_id: actualConversationId,
      user_id: userId,
      content: content.trim(),
      attachment_url: attachment_url || null,
      reactions: [],
      is_read: false,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    const res = await db.collection('messages').insertOne(newMessage);
    const messageId = res.insertedId.toString();

    // Update last_message on conversation
    await db.collection('conversations').updateOne(
      { _id: conv._id },
      {
        $set: {
          last_message: {
            content: newMessage.content,
            user_id: userId,
            created_at: now,
          },
          updated_at: now,
        },
      }
    );

    const author = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const payload = {
      id: messageId,
      conversation_id: actualConversationId,
      user_id: userId,
      content: newMessage.content,
      attachment_url: newMessage.attachment_url,
      reactions: [],
      is_read: false,
      created_at: now.toISOString(),
      profiles: {
        id: userId,
        username: author?.username || author?.name || 'User',
        name: author?.name || author?.username || 'User',
        avatar_url: author?.avatar_url || author?.image || null,
      },
    };

    // Broadcast over Pusher
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`conversation-${actualConversationId}`, 'new-message', payload);
        if (conversationId !== actualConversationId) {
          await pusher.trigger(`conversation-${conversationId}`, 'new-message', payload);
        }
      }
    } catch (e) {
      console.warn('Pusher DM broadcast warning:', e.message);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error('Error sending DM:', error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
