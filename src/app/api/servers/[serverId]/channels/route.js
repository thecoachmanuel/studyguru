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

    const { serverId } = await params;
    const { name, type = 'text' } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();

    // Verify member role (owner or admin required to create channels)
    const membership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: userId,
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and administrators can create channels' }, { status: 403 });
    }

    // Count existing channels for position
    const channelCount = await db.collection('channels').countDocuments({ server_id: serverId });

    const newChannel = {
      server_id: serverId,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type: type === 'voice' ? 'voice' : 'text',
      position: channelCount,
      created_at: new Date(),
    };

    const res = await db.collection('channels').insertOne(newChannel);
    const channelData = {
      id: res.insertedId.toString(),
      ...newChannel,
    };

    // Broadcast channel creation via Pusher
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`server-${serverId}`, 'channel-created', channelData);
    } catch (e) {
      console.warn('Pusher broadcast warning:', e.message);
    }

    return NextResponse.json(channelData, { status: 201 });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ error: error.message || 'Failed to create channel' }, { status: 500 });
  }
}
