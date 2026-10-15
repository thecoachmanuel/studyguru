import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

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
    const userId = String(session.user.id);
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
    const isOwner = String(server.owner_id) === userId;
    const existingMember = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: userId,
    });

    if (!existingMember) {
      await db.collection('server_members').insertOne({
        server_id: serverId,
        user_id: userId,
        role: isOwner ? 'owner' : 'member',
        joined_at: new Date(),
      });
    }

    // Count members
    const memberCount = await db.collection('server_members').countDocuments({
      $or: [{ server_id: serverId }, { server_id: safeObjectId(serverId) }],
    });

    // Fetch channels
    const channels = await db.collection('channels')
      .find({
        $or: [{ server_id: serverId }, { server_id: server.id || serverId }],
      })
      .sort({ position: 1, created_at: 1 })
      .toArray();

    const serverData = {
      id: serverId,
      name: server.name,
      category: server.category || 'Computer Science',
      icon_url: server.icon_url || null,
      owner_id: server.owner_id,
      invite_code: server.invite_code,
      role: isOwner ? 'owner' : (existingMember ? existingMember.role : 'member'),
      is_member: true,
      member_count: Math.max(memberCount, 1),
      created_at: server.created_at,
      channels: channels.map((c) => ({
        id: c._id.toString(),
        server_id: c.server_id,
        name: c.name,
        type: c.type || 'text',
        position: c.position || 0,
      })),
    };

    // Broadcast real-time room-joined update to all users across devices
    try {
      const pusher = getPusherServer();
      await pusher.trigger('rooms-global', 'room-joined', {
        serverId,
        userId,
        userName: session.user.name || 'A student',
        memberCount: Math.max(memberCount, 1),
      });
      await pusher.trigger(`server-${serverId}`, 'member-joined', {
        serverId,
        userId,
        userName: session.user.name || 'A student',
        memberCount: Math.max(memberCount, 1),
      });
    } catch (pushErr) {
      console.warn('Pusher room-joined broadcast error:', pushErr);
    }

    return NextResponse.json({
      ...serverData,
      server: serverData,
    });
  } catch (error) {
    console.error('Error joining server:', error);
    return NextResponse.json({ error: error.message || 'Failed to join server' }, { status: 500 });
  }
}
