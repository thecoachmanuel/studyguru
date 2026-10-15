import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = body.invite_code || body.code || body.inviteCode;
    if (!rawCode || !String(rawCode).trim()) {
      return NextResponse.json({ error: 'Room ID or Invite code is required' }, { status: 400 });
    }

    const code = String(rawCode).trim();
    const userId = session.user.id;
    const db = await getDatabase();

    const server = await db.collection('servers').findOne({
      $or: [
        { invite_code: code },
        { invite_code: code.toUpperCase() },
        { _id: safeObjectId(code) },
        { id: code },
      ],
    });
    if (!server) {
      return NextResponse.json({ error: 'Invalid room code/ID or study room not found' }, { status: 404 });
    }

    const serverId = server._id.toString();

    // Check if user is banned
    const ban = await db.collection('server_bans').findOne({ server_id: serverId, user_id: userId });
    if (ban) {
      return NextResponse.json({ error: 'You are banned from this server.' }, { status: 403 });
    }

    // Check if user is already a member
    const existingMember = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: userId,
    });

    if (!existingMember) {
      await db.collection('server_members').insertOne({
        server_id: serverId,
        user_id: userId,
        role: 'member',
        joined_at: new Date(),
      });
    }

    // Fetch channels
    const channels = await db.collection('channels')
      .find({ server_id: serverId })
      .sort({ position: 1, created_at: 1 })
      .toArray();

    const serverData = {
      id: serverId,
      name: server.name,
      icon_url: server.icon_url || null,
      owner_id: server.owner_id,
      invite_code: server.invite_code,
      role: existingMember ? existingMember.role : 'member',
      created_at: server.created_at,
      channels: channels.map(c => ({
        id: c._id.toString(),
        server_id: c.server_id,
        name: c.name,
        type: c.type || 'text',
        position: c.position || 0,
      })),
    };

    return NextResponse.json({
      ...serverData,
      server: serverData,
    });
  } catch (error) {
    console.error('Error joining server:', error);
    return NextResponse.json({ error: error.message || 'Failed to join server' }, { status: 500 });
  }
}
