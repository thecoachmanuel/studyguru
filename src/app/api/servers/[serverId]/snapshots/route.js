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
    const userId = session.user.id;
    const db = await getDatabase();

    const now = new Date();
    const serverObjId = safeObjectId(serverId);

    // Fetch active (unexpired) snapshots for this server
    const snapshots = await db.collection('snapshots')
      .find({
        $or: [{ server_id: serverId }, { server_id: serverObjId }],
        expires_at: { $gt: now },
      })
      .sort({ created_at: -1 })
      .limit(30)
      .toArray();

    const userIds = [...new Set(snapshots.map((s) => s.user_id))];
    const userQueryIds = userIds.map((id) => safeObjectId(id));

    const authors = await db.collection('users')
      .find({
        $or: [{ _id: { $in: userQueryIds } }, { id: { $in: userIds } }],
      })
      .toArray();

    const authorMap = new Map();
    authors.forEach((u) => {
      authorMap.set(u._id.toString(), u);
      if (u.id) authorMap.set(String(u.id), u);
    });

    const formatted = snapshots.map((s) => {
      const author = authorMap.get(s.user_id);
      const viewers = Array.isArray(s.viewers) ? s.viewers : [];
      return {
        id: s._id.toString(),
        server_id: s.server_id,
        user_id: s.user_id,
        image_url: s.image_url || null,
        caption: s.caption || '',
        created_at: s.created_at,
        expires_at: s.expires_at,
        is_viewed: viewers.includes(userId),
        view_count: viewers.length,
        author: {
          id: s.user_id,
          username: author?.username || author?.name || 'Study Buddy',
          name: author?.name || author?.username || 'Study Buddy',
          avatar_url: author?.avatar_url || author?.image || null,
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const userId = session.user.id;

    let body = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
      } catch {}
    }

    const { image_url = '', caption = '' } = body || {};

    if (!image_url && !caption) {
      return NextResponse.json({ error: 'Snapshot image or note is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const now = new Date();
    // 24 hours TTL
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newSnapshot = {
      server_id: serverId,
      user_id: userId,
      image_url: image_url || null,
      caption: String(caption).slice(0, 300).trim(),
      viewers: [userId], // Author has viewed their own
      created_at: now,
      expires_at: expiresAt,
    };

    const res = await db.collection('snapshots').insertOne(newSnapshot);
    const snapshotId = res.insertedId.toString();

    // Fetch author
    const author = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const payload = {
      id: snapshotId,
      server_id: serverId,
      user_id: userId,
      image_url: newSnapshot.image_url,
      caption: newSnapshot.caption,
      created_at: now,
      expires_at: expiresAt,
      is_viewed: true,
      view_count: 1,
      author: {
        id: userId,
        username: author?.username || session.user.name || 'Study Buddy',
        name: author?.name || session.user.name || 'Study Buddy',
        avatar_url: author?.avatar_url || session.user.image || null,
      },
    };

    // Realtime notification
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`server-${serverId}`, 'new-snapshot', payload);
    } catch (e) {
      console.warn('Pusher snapshot broadcast warning:', e.message);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json({ error: error.message || 'Failed to create snapshot' }, { status: 500 });
  }
}
