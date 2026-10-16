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

    // 2. Fetch notifications for user from MongoDB
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

    // Custom notification creation
    if (action === 'create' && body.notification) {
      const newNotif = {
        ...body.notification,
        recipient_id: body.notification.recipient_id || userId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const insertResult = await db.collection('notifications').insertOne(newNotif);
      return NextResponse.json({ success: true, id: insertResult.insertedId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
