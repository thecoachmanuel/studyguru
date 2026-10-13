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

    const { conversationId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();

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

    return NextResponse.json({ success: true, markedRead: unreadUpdate.modifiedCount });
  } catch (error) {
    console.error('Error marking conversation messages as read:', error);
    return NextResponse.json({ error: error.message || 'Failed to mark as read' }, { status: 500 });
  }
}
