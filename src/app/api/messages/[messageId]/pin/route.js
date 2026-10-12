import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();
    const msgObjectId = safeObjectId(messageId);

    const message = await db.collection('messages').findOne({
      $or: [{ _id: msgObjectId }, { id: messageId }],
    });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await db.collection('messages').updateOne(
      { $or: [{ _id: msgObjectId }, { id: messageId }] },
      { $set: { is_pinned: true, pinned_at: new Date(), pinned_by: userId } }
    );

    try {
      const pusher = getPusherServer();
      await pusher.trigger(`channel-${message.channel_id}`, 'message-pinned', {
        messageId,
        channelId: message.channel_id,
        isPinned: true,
      });
    } catch (e) {
      console.warn('Pusher broadcast error:', e.message);
    }

    return NextResponse.json({ success: true, is_pinned: true });
  } catch (error) {
    console.error('Error pinning message:', error);
    return NextResponse.json({ error: error.message || 'Failed to pin message' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await params;
    const db = await getDatabase();
    const msgObjectId = safeObjectId(messageId);

    const message = await db.collection('messages').findOne({
      $or: [{ _id: msgObjectId }, { id: messageId }],
    });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await db.collection('messages').updateOne(
      { $or: [{ _id: msgObjectId }, { id: messageId }] },
      { $set: { is_pinned: false, pinned_at: null, pinned_by: null } }
    );

    try {
      const pusher = getPusherServer();
      await pusher.trigger(`channel-${message.channel_id}`, 'message-unpinned', {
        messageId,
        channelId: message.channel_id,
        isPinned: false,
      });
    } catch (e) {
      console.warn('Pusher broadcast error:', e.message);
    }

    return NextResponse.json({ success: true, is_pinned: false });
  } catch (error) {
    console.error('Error unpinning message:', error);
    return NextResponse.json({ error: error.message || 'Failed to unpin message' }, { status: 500 });
  }
}
