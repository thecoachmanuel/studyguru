import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function DELETE(req, { params }) {
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

    // Check ownership or admin role
    const isAuthor = message.user_id === userId;
    let hasAdmin = false;

    if (!isAuthor) {
      // Find channel to find server
      const chanId = safeObjectId(message.channel_id);
      const channel = await db.collection('channels').findOne({
        $or: [{ _id: chanId }, { id: message.channel_id }],
      });
      if (channel) {
        const membership = await db.collection('server_members').findOne({
          server_id: channel.server_id,
          user_id: userId,
        });
        hasAdmin = membership && ['owner', 'admin'].includes(membership.role);
      }
    }

    if (!isAuthor && !hasAdmin) {
      return NextResponse.json({ error: 'You do not have permission to delete this message' }, { status: 403 });
    }

    // Soft delete
    await db.collection('messages').updateOne(
      { $or: [{ _id: msgObjectId }, { id: messageId }] },
      { $set: { deleted_at: new Date() } }
    );

    // Broadcast deletion
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`channel-${message.channel_id}`, 'message-deleted', {
        messageId: messageId,
        channelId: message.channel_id,
      });
    } catch (e) {
      console.warn('Pusher broadcast error:', e.message);
    }

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete message' }, { status: 500 });
  }
}
