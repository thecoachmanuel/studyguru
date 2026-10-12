import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId, userId: targetUserId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {}

    const { reason = '' } = body || {};
    const db = await getDatabase();
    const queryId = safeObjectId(serverId);

    const server = await db.collection('servers').findOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const callerMembership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: session.user.id,
    });

    const isOwner = server.owner_id === session.user.id;
    if (!isOwner && callerMembership?.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const targetMembership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: targetUserId,
    });

    if (targetMembership?.role === 'owner') {
      return NextResponse.json({ error: 'Cannot ban group owner' }, { status: 403 });
    }

    if (!isOwner && targetMembership?.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot ban other admins' }, { status: 403 });
    }

    // Remove from members
    await db.collection('server_members').deleteOne({
      server_id: serverId,
      user_id: targetUserId,
    });

    // Add to server_bans
    await db.collection('server_bans').updateOne(
      { server_id: serverId, user_id: targetUserId },
      {
        $set: {
          server_id: serverId,
          user_id: targetUserId,
          reason: reason || 'Banned by group administrator',
          banned_by: session.user.id,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error banning member:', error);
    return NextResponse.json({ error: error.message || 'Failed to ban member' }, { status: 500 });
  }
}
