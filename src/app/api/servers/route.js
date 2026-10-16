import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';
import crypto from 'crypto';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String(session.user.id);
    const userIdObj = safeObjectId(userId);

    const { searchParams } = new URL(req.url, 'http://localhost');
    const showAll = searchParams.get('all') === 'true' || searchParams.get('discover') === 'true';

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
          name: 'StudyCord Hub',
          icon_url: null,
          owner_id: userId,
          invite_code: 'GURU2026',
          role: 'owner',
          is_member: true,
          member_count: 1,
          category: null,
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
          is_member: true,
          member_count: 3,
          category: null,
          created_at: new Date().toISOString(),
          channels: [
            { id: 'ch-algos', server_id: 'server-demo-2', name: 'algorithms', type: 'text', position: 0 },
            { id: 'ch-ai', server_id: 'server-demo-2', name: 'ai-discussions', type: 'text', position: 1 },
            { id: 'ch-peer', server_id: 'server-demo-2', name: 'Study Room', type: 'voice', position: 2 },
          ],
        },
      ]);
    }

    // Find all memberships for this user (robust to string vs ObjectId)
    const memberships = await db.collection('server_members').find({
      $or: [
        { user_id: userId },
        ...(userIdObj ? [{ user_id: userIdObj }] : []),
      ],
    }).toArray();

    const serverIds = memberships.map((m) => safeObjectId(m.server_id)).filter(Boolean);
    const serverIdStrings = memberships.map((m) => String(m.server_id));
    const membershipMap = new Map(memberships.map((m) => [String(m.server_id), m]));

    // Query servers:
    // If showAll=true: return all active study rooms across the entire community!
    // If showAll=false: return servers user owns OR is a member of.
    let servers = [];
    if (showAll) {
      servers = await db.collection('servers').find({}).sort({ created_at: -1 }).toArray();
    } else {
      servers = await db.collection('servers').find({
        $or: [
          { _id: { $in: serverIds } },
          { id: { $in: serverIdStrings } },
          { owner_id: userId },
          ...(userIdObj ? [{ owner_id: userIdObj }] : []),
        ],
      }).sort({ created_at: -1 }).toArray();
    }

    // Pre-calculate member counts for all matching servers
    const allMatchingServerIdStrings = servers.map((s) => s._id.toString());
    const memberCountsByServer = {};
    if (allMatchingServerIdStrings.length > 0) {
      const allMembers = await db.collection('server_members').find({
        $or: [
          { server_id: { $in: allMatchingServerIdStrings } },
          { server_id: { $in: servers.map((s) => s._id) } },
        ],
      }).toArray();

      for (const m of allMembers) {
        const sId = String(m.server_id);
        memberCountsByServer[sId] = (memberCountsByServer[sId] || 0) + 1;
      }
    }

    const enrichedServers = await Promise.all(servers.map(async (srv) => {
      const srvIdStr = srv._id.toString();
      const channels = await db.collection('channels')
        .find({
          $or: [
            { server_id: srvIdStr },
            { server_id: srv.id || srvIdStr },
          ],
        })
        .sort({ position: 1, created_at: 1 })
        .toArray();

      const isOwner = String(srv.owner_id) === userId;
      const membership = membershipMap.get(srvIdStr);
      const isMember = Boolean(isOwner || membership);

      // Auto-heal owner membership if missing in DB
      if (isOwner && !membership) {
        db.collection('server_members').updateOne(
          { server_id: srvIdStr, user_id: userId },
          { $setOnInsert: { server_id: srvIdStr, user_id: userId, role: 'owner', joined_at: srv.created_at || new Date() } },
          { upsert: true }
        ).catch(() => {});
      }

      const role = membership?.role || (isOwner ? 'owner' : null);
      const count = memberCountsByServer[srvIdStr] || (isMember ? 1 : 0);

      return {
        id: srvIdStr,
        name: srv.name,
        category: srv.category ? String(srv.category).trim() : null,
        icon_url: srv.icon_url || null,
        owner_id: srv.owner_id,
        invite_code: srv.invite_code,
        role,
        is_member: isMember,
        is_audio_space: Boolean(srv.is_audio_space),
        member_count: Math.max(count, 1),
        created_at: srv.created_at,
        channels: channels.map((c) => ({
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

    const body = await req.json().catch(() => ({}));
    const { name, category, isAudioSpace } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
    }

    const userId = String(session.user.id);
    const db = await getDatabase();
    const now = new Date();

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const newServer = {
      name: name.trim(),
      category: category && String(category).trim() ? String(category).trim() : null,
      owner_id: userId,
      icon_url: null,
      invite_code: inviteCode,
      is_audio_space: Boolean(isAudioSpace),
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

    // Create default voice channel (Study Room)
    const voiceChannel = await db.collection('channels').insertOne({
      server_id: serverId,
      name: isAudioSpace ? 'Live Space' : 'Study Room',
      type: 'voice',
      position: 1,
      created_at: now,
    });

    const enrichedServer = {
      id: serverId,
      name: newServer.name,
      category: newServer.category,
      owner_id: userId,
      icon_url: null,
      invite_code: inviteCode,
      role: 'owner',
      is_member: true,
      member_count: 1,
      is_audio_space: Boolean(isAudioSpace),
      created_at: now.toISOString(),
      channels: [
        { id: textChannel.insertedId.toString(), server_id: serverId, name: 'general', type: 'text', position: 0 },
        { id: voiceChannel.insertedId.toString(), server_id: serverId, name: isAudioSpace ? 'Live Space' : 'Study Room', type: 'voice', position: 1 },
      ],
    };

    // Pusher Broadcast to all users and devices in real-time
    try {
      const pusher = getPusherServer();
      await pusher.trigger('rooms-global', 'room-created', enrichedServer);
    } catch (pushErr) {
      console.warn('Pusher room-created broadcast error:', pushErr);
    }

    return NextResponse.json(enrichedServer, { status: 201 });
  } catch (error) {
    console.error('Error creating server:', error);
    return NextResponse.json({ error: error.message || 'Failed to create server' }, { status: 500 });
  }
}
