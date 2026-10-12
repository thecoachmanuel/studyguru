import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // Database not connected, fallback to demo servers below
    }

    if (!db) {
      return NextResponse.json([
        {
          id: 'server-demo-1',
          name: 'StudyGuru Hub',
          icon_url: null,
          owner_id: userId,
          invite_code: 'GURU2026',
          role: 'owner',
          created_at: new Date().toISOString(),
          channels: [
            { id: 'ch-general', server_id: 'server-demo-1', name: 'general', type: 'text', position: 0 },
            { id: 'ch-resources', server_id: 'server-demo-1', name: 'study-resources', type: 'text', position: 1 },
            { id: 'ch-voice', server_id: 'server-demo-1', name: 'Study Room', type: 'voice', position: 2 },
          ],
        },
        {
          id: 'server-demo-2',
          name: 'Computer Science & AI',
          icon_url: null,
          owner_id: userId,
          invite_code: 'CSAI2026',
          role: 'member',
          created_at: new Date().toISOString(),
          channels: [
            { id: 'ch-algos', server_id: 'server-demo-2', name: 'algorithms', type: 'text', position: 0 },
            { id: 'ch-ai', server_id: 'server-demo-2', name: 'ai-discussions', type: 'text', position: 1 },
            { id: 'ch-peer', server_id: 'server-demo-2', name: 'Study Room', type: 'voice', position: 2 },
          ],
        },
      ]);
    }

    // Find all memberships for this user
    const memberships = await db.collection('server_members').find({ user_id: userId }).toArray();
    const serverIds = memberships.map((m) => safeObjectId(m.server_id));

    // Fetch the servers
    const servers = await db.collection('servers').find({
      $or: [
        { _id: { $in: serverIds } },
        { id: { $in: memberships.map((m) => m.server_id) } },
      ],
    }).toArray();

    // Attach user role and channels to each server
    const membershipMap = new Map(memberships.map(m => [m.server_id.toString(), m]));

    const enrichedServers = await Promise.all(servers.map(async (srv) => {
      const srvIdStr = srv._id.toString();
      const channels = await db.collection('channels')
        .find({ server_id: srvIdStr })
        .sort({ position: 1, created_at: 1 })
        .toArray();

      return {
        id: srvIdStr,
        name: srv.name,
        icon_url: srv.icon_url || null,
        owner_id: srv.owner_id,
        invite_code: srv.invite_code,
        role: membershipMap.get(srvIdStr)?.role || 'member',
        created_at: srv.created_at,
        channels: channels.map(c => ({
          id: c._id.toString(),
          server_id: c.server_id,
          name: c.name,
          type: c.type || 'text',
          position: c.position || 0,
        })),
      };
    }));

    return NextResponse.json(enrichedServers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch servers' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const now = new Date();

    const inviteCode = crypto.randomBytes(4).toString('hex'); // 8-char invite code

    const newServer = {
      name: name.trim(),
      owner_id: userId,
      icon_url: null,
      invite_code: inviteCode,
      created_at: now,
      updated_at: now,
    };

    const serverRes = await db.collection('servers').insertOne(newServer);
    const serverId = serverRes.insertedId.toString();

    // Add owner as server member
    await db.collection('server_members').insertOne({
      server_id: serverId,
      user_id: userId,
      role: 'owner',
      joined_at: now,
    });

    // Create default text channel
    const textChannel = await db.collection('channels').insertOne({
      server_id: serverId,
      name: 'general',
      type: 'text',
      position: 0,
      created_at: now,
    });

    // Create default voice channel
    const voiceChannel = await db.collection('channels').insertOne({
      server_id: serverId,
      name: 'Study Room',
      type: 'voice',
      position: 1,
      created_at: now,
    });

    return NextResponse.json({
      id: serverId,
      name: newServer.name,
      owner_id: userId,
      icon_url: null,
      invite_code: inviteCode,
      role: 'owner',
      created_at: now,
      channels: [
        { id: textChannel.insertedId.toString(), server_id: serverId, name: 'general', type: 'text', position: 0 },
        { id: voiceChannel.insertedId.toString(), server_id: serverId, name: 'Study Room', type: 'voice', position: 1 },
      ],
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating server:', error);
    return NextResponse.json({ error: error.message || 'Failed to create server' }, { status: 500 });
  }
}
