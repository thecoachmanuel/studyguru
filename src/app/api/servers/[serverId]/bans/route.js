import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const db = await getDatabase();
    const queryId = safeObjectId(serverId);

    const server = await db.collection('servers').findOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const isOwner = server.owner_id === session.user.id;
    const membership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: session.user.id,
    });

    if (!isOwner && membership?.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const bans = await db.collection('server_bans')
      .find({ server_id: serverId })
      .sort({ created_at: -1 })
      .toArray();

    if (bans.length === 0) {
      return NextResponse.json({ bans: [] });
    }

    const userIds = bans.map((b) => b.user_id);
    const queryUserIds = userIds.map((id) => safeObjectId(id));

    const users = await db.collection('users')
      .find({
        $or: [
          { _id: { $in: queryUserIds } },
          { id: { $in: userIds } },
        ],
      })
      .toArray();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(u._id.toString(), u);
      if (u.id) userMap.set(String(u.id), u);
    });

    const formattedBans = bans.map((b) => {
      const u = userMap.get(b.user_id);
      return {
        id: b._id.toString(),
        user_id: b.user_id,
        reason: b.reason || '',
        created_at: b.created_at,
        profile: {
          id: b.user_id,
          username: u?.username || u?.name || 'User',
          full_name: u?.name || u?.username || 'User',
          avatar_url: u?.avatar_url || u?.image || null,
          email: u?.email || null,
        },
      };
    });

    return NextResponse.json({ bans: formattedBans });
  } catch (error) {
    console.error('Error fetching server bans:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch bans' }, { status: 500 });
  }
}
