import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import crypto from 'crypto';

export async function POST(req, { params }) {
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

    const membership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: session.user.id,
    });

    const isOwner = server.owner_id === session.user.id;
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    await db.collection('servers').updateOne(
      { $or: [{ _id: queryId }, { id: serverId }] },
      { $set: { invite_code: newCode, updated_at: new Date() } }
    );

    return NextResponse.json({ success: true, invite_code: newCode });
  } catch (error) {
    console.error('Error regenerating invite code:', error);
    return NextResponse.json({ error: error.message || 'Failed to regenerate invite' }, { status: 500 });
  }
}
