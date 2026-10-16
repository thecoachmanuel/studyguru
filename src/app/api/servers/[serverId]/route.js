import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function GET(req, { params }) {
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
      // Offline fallback
    }

    if (!db) {
      return NextResponse.json({
        id: serverId,
        name: 'StudyGuru Hub',
        description: 'Collaborative AI study group',
        invite_code: 'GURU2026',
        owner_id: session.user.id,
      });
    }

    const queryId = safeObjectId(serverId);
    const server = await db.collection('servers').findOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const srvIdStr = server._id.toString();
    const channels = await db.collection('channels')
      .find({
        $or: [{ server_id: srvIdStr }, { server_id: server.id || serverId }],
      })
      .sort({ position: 1, created_at: 1 })
      .toArray();

    return NextResponse.json({
      id: srvIdStr,
      name: server.name,
      description: server.description || '',
      category: server.category || 'General Study',
      icon_url: server.icon_url || null,
      invite_code: server.invite_code,
      owner_id: server.owner_id,
      created_at: server.created_at,
      channels: channels.map((c) => ({
        id: c._id.toString(),
        server_id: c.server_id,
        name: c.name,
        type: c.type || 'text',
        position: c.position || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching server:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const body = await req.json();
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // Offline fallback
    }

    if (!db) {
      return NextResponse.json({ success: true, ...body });
    }

    const queryId = safeObjectId(serverId);

    const updates = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.category !== undefined) updates.category = body.category.trim();
    if (body.icon_url !== undefined) updates.icon_url = body.icon_url;

    await db.collection('servers').updateOne(
      { $or: [{ _id: queryId }, { id: serverId }] },
      { $set: { ...updates, updated_at: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating server:', error);
    return NextResponse.json({ error: error.message || 'Failed to update server' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
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
      // Offline fallback
    }

    if (!db) {
      return NextResponse.json({ success: true });
    }

    const queryId = safeObjectId(serverId);

    await db.collection('servers').deleteOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });
    await db.collection('server_members').deleteMany({ server_id: serverId });
    await db.collection('channels').deleteMany({ server_id: serverId });

    try {
      const pusher = getPusherServer();
      await pusher.trigger('rooms-global', 'room-deleted', { serverId });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting server:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete server' }, { status: 500 });
  }
}
