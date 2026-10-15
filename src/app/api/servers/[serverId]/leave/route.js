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

    const { serverId } = await params;
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // Offline / demo fallback
    }

    if (!db) {
      return NextResponse.json({ success: true, message: 'Left server successfully' });
    }

    const userId = String(session.user.id);

    await db.collection('server_members').deleteOne({
      server_id: serverId,
      user_id: userId,
    });

    const memberCount = await db.collection('server_members').countDocuments({
      $or: [{ server_id: serverId }, { server_id: safeObjectId(serverId) }],
    });

    // Broadcast room-left via Pusher
    try {
      const pusher = getPusherServer();
      await pusher.trigger('rooms-global', 'room-left', {
        serverId,
        userId,
        memberCount: Math.max(memberCount, 0),
      });
      await pusher.trigger(`server-${serverId}`, 'member-left', {
        serverId,
        userId,
        memberCount: Math.max(memberCount, 0),
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'Left server successfully' });
  } catch (error) {
    console.error('Error leaving server:', error);
    return NextResponse.json({ error: error.message || 'Failed to leave server' }, { status: 500 });
  }
}

export const DELETE = POST;
