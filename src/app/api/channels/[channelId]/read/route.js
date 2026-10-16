import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const now = new Date();

    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // In-memory or fallback mode
    }

    if (db) {
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

      // Mark messages in channel as read
      await db.collection('messages').updateMany(
        { channel_id: channelId, user_id: { $ne: userId } },
        {
          $addToSet: { read_by: userId },
          $set: { is_read: true, read_at: now },
        }
      );
    }

    // Broadcast messages-read event via Pusher so sender UI immediately updates to ✓✓
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`channel-${channelId}`, 'messages-read', {
          channelId,
          readBy: userId,
          readAt: now.toISOString(),
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      channel_id: channelId,
      last_read_at: now.toISOString(),
    });
  } catch (error) {
    console.error('Error marking channel as read:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark channel as read' },
      { status: 500 }
    );
  }
}
