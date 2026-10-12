import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const body = await req.json();
    const { new_owner_id } = body || {};

    if (!new_owner_id) {
      return NextResponse.json({ error: 'New owner ID is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const queryId = safeObjectId(serverId);

    const server = await db.collection('servers').findOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    if (server.owner_id !== session.user.id) {
      return NextResponse.json({ error: 'Only the current group owner can transfer ownership' }, { status: 403 });
    }

    // Verify target is a member
    const targetMember = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: new_owner_id,
    });

    if (!targetMember) {
      return NextResponse.json({ error: 'Target user is not a member of this group' }, { status: 400 });
    }

    // Update server owner
    await db.collection('servers').updateOne(
      { $or: [{ _id: queryId }, { id: serverId }] },
      { $set: { owner_id: new_owner_id, updated_at: new Date() } }
    );

    // Update new owner role
    await db.collection('server_members').updateOne(
      { server_id: serverId, user_id: new_owner_id },
      { $set: { role: 'owner' } }
    );

    // Demote old owner to admin
    await db.collection('server_members').updateOne(
      { server_id: serverId, user_id: session.user.id },
      { $set: { role: 'admin' } }
    );

    return NextResponse.json({ success: true, new_owner_id });
  } catch (error) {
    console.error('Error transferring server ownership:', error);
    return NextResponse.json({ error: error.message || 'Failed to transfer ownership' }, { status: 500 });
  }
}
