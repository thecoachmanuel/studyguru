import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';

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
    }

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
