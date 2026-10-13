import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');
    const channelIdsParam = searchParams.get('channelIds');

    const userId = session.user.id;
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // In-memory or fallback mode
    }

    if (!db) {
      return NextResponse.json({ unreadCounts: {} });
    }

    let channelList = [];
    if (serverId) {
      channelList = await db.collection('channels')
        .find({
          $or: [
            { server_id: serverId },
            { server_id: safeObjectId(serverId) },
          ],
        })
        .toArray();
    } else if (channelIdsParam) {
      const ids = channelIdsParam.split(',').filter(Boolean);
      channelList = await db.collection('channels')
        .find({
          $or: [
            { _id: { $in: ids.map(safeObjectId) } },
            { id: { $in: ids } },
          ],
        })
        .toArray();
    }

    if (channelList.length === 0) {
      return NextResponse.json({ unreadCounts: {} });
    }

    // Get string IDs for all text channels
    const textChannels = channelList.filter((c) => c.type !== 'voice');
    const channelIds = textChannels.map((c) => (c._id ? c._id.toString() : c.id));

    // Get read timestamps for the current user
    const reads = await db.collection('channel_reads')
      .find({
        user_id: userId,
        channel_id: { $in: channelIds },
      })
      .toArray();

    const readMap = new Map();
    reads.forEach((r) => {
      readMap.set(r.channel_id, new Date(r.last_read_at));
    });

    const unreadCounts = {};

    await Promise.all(
      textChannels.map(async (c) => {
        const cid = c._id ? c._id.toString() : c.id;
        const lastRead = readMap.get(cid);

        const query = {
          channel_id: cid,
          user_id: { $ne: userId },
          deleted_at: null,
        };

        if (lastRead) {
          query.created_at = { $gt: lastRead };
        }

        try {
          const count = await db.collection('messages').countDocuments(query);
          unreadCounts[cid] = count;
        } catch {
          unreadCounts[cid] = 0;
        }
      })
    );

    return NextResponse.json({ unreadCounts });
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch unread counts', unreadCounts: {} },
      { status: 500 }
    );
  }
}
