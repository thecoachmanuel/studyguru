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

    if (!targetMembership) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    if (targetMembership.role === 'owner') {
      return NextResponse.json({ error: 'Cannot kick group owner' }, { status: 403 });
    }

    if (!isOwner && targetMembership.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot kick other admins' }, { status: 403 });
    }

    await db.collection('server_members').deleteOne({
      server_id: serverId,
      user_id: targetUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error kicking member:', error);
    return NextResponse.json({ error: error.message || 'Failed to kick member' }, { status: 500 });
  }
}
