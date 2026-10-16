import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';
import { getServerVoiceCounts } from '@/lib/voiceStore';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String(session.user.id || session.user._id);
    const db = await getDatabase();

    // 1. Fetch live voice spaces
    const voiceData = await getServerVoiceCounts('all');
    const counts = voiceData?.counts || {};
    const speakers = voiceData?.speakers || {};

    const activeChannelIds = Object.keys(counts).filter((id) => (counts[id] || 0) > 0);

    let activeSpaces = [];

    if (activeChannelIds.length > 0) {
      // Find server & channel metadata for these active channels
      const servers = await db
        .collection('servers')
        .find({ 'channels.id': { $in: activeChannelIds } })
        .toArray();

      const channelMap = new Map();
      servers.forEach((srv) => {
        (srv.channels || []).forEach((ch) => {
          if (activeChannelIds.includes(ch.id)) {
            channelMap.set(ch.id, {
              channelId: ch.id,
              channelName: ch.name,
              channelType: ch.type,
              serverId: srv.id,
              serverName: srv.name,
              category: srv.category || srv.subject || 'General Study',
            });
          }
        });
      });

      activeSpaces = activeChannelIds.map((cId) => {
        const meta = channelMap.get(cId) || {
          channelId: cId,
          channelName: 'Live Study Space',
          channelType: 'voice',
          serverId: null,
          serverName: 'Study Group',
          category: 'Live Voice',
        };
        return {
          ...meta,
          activeCount: counts[cId] || 1,
          speakers: speakers[cId] || [],
        };
      });
    }

    // Automatic storage protection: prune expired notifications (>14 days old, or read >7 days old)
    try {
      const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const cutoffRead7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      db.collection('notifications').deleteMany({
        $or: [
          { createdAt: { $lt: cutoff14d } },
          { read: true, createdAt: { $lt: cutoffRead7d } },
        ],
      }).catch(() => {});
    } catch {}

    // 2. Fetch notifications for user from MongoDB (capped at latest 40 to protect storage and memory)
    const notifications = await db
      .collection('notifications')
      .find({
        $or: [
          { recipient_id: userId },
          { user_id: userId },
          { is_global: true },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(40)
      .toArray();

    const normalizedNotifications = notifications.map((n) => ({
      id: String(n._id || n.id),
      type: n.type || 'info', // 'space-started' | 'follow' | 'mention' | 'invite'
      title: n.title || 'Notification',
      message: n.message || '',
      actor: n.actor || null, // { name, avatar_url, username }
      data: n.data || {},
      read: Boolean(n.read),
      createdAt: n.createdAt || n.created_at || new Date().toISOString(),
    }));

    const unreadCount =
      normalizedNotifications.filter((n) => !n.read).length + activeSpaces.length;

    return NextResponse.json({
      activeSpaces,
      notifications: normalizedNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error in GET /api/notifications:', error);
    return NextResponse.json({ activeSpaces: [], notifications: [], unreadCount: 0 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String(session.user.id || session.user._id);
    const body = await req.json();
    const db = await getDatabase();

    const { action, notificationId } = body || {};

    if (action === 'mark-all-read') {
      await db.collection('notifications').updateMany(
        {
          $or: [{ recipient_id: userId }, { user_id: userId }],
          read: { $ne: true },
        },
        { $set: { read: true, readAt: new Date().toISOString() } }
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'clear-all' || action === 'wipe-all') {
      await db.collection('notifications').deleteMany({
        $or: [{ recipient_id: userId }, { user_id: userId }],
      });
      return NextResponse.json({ success: true, wiped: true });
    }

    if (action === 'delete' && notificationId) {
      await db.collection('notifications').deleteOne({
        $or: [{ _id: notificationId }, { id: notificationId }],
        $or: [{ recipient_id: userId }, { user_id: userId }],
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'mark-read' && notificationId) {
      await db.collection('notifications').updateOne(
        {
          $or: [{ _id: notificationId }, { id: notificationId }],
          $or: [{ recipient_id: userId }, { user_id: userId }],
        },
        { $set: { read: true, readAt: new Date().toISOString() } }
      );
      return NextResponse.json({ success: true });
    }

    // Custom notification creation with storage cap protection (max 50 notifications per user)
    if (action === 'create' && body.notification) {
      const newNotif = {
        ...body.notification,
        recipient_id: body.notification.recipient_id || userId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const insertResult = await db.collection('notifications').insertOne(newNotif);

      // Storage preservation: prune excess user notifications beyond latest 50
      try {
        const excess = await db.collection('notifications')
          .find({ recipient_id: newNotif.recipient_id })
          .sort({ createdAt: -1 })
          .skip(50)
          .toArray();
        if (excess.length > 0) {
          const idsToDelete = excess.map((e) => e._id);
          await db.collection('notifications').deleteMany({ _id: { $in: idsToDelete } });
        }
      } catch {}

      return NextResponse.json({ success: true, id: insertResult.insertedId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
