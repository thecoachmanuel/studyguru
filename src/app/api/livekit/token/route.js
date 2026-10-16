import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { auth } from '@/auth';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const roomName = String(body.roomName || body.channelId || body.channelName || '').trim();
    if (!roomName) {
      return NextResponse.json({ error: 'Room name or channelId is required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    // Graceful fallback if LiveKit credentials are not yet configured in environment
    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        {
          error: 'LiveKit server credentials not configured. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env.local',
          configured: false,
        },
        { status: 503 }
      );
    }

    const userId = session.user.id || body.participantId || `user-${Date.now()}`;
    const identity = String(userId);
    const participantName = String(body.participantName || session.user.name || session.user.email?.split('@')[0] || 'Student').trim();
    
    const metadata = {
      userId: identity,
      name: participantName,
      image: session.user.image || body.avatar || '',
      serverId: body.serverId || null,
      channelId: roomName,
      channelName: body.channelName || roomName,
      joinedAt: new Date().toISOString(),
    };

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      metadata: JSON.stringify(metadata),
      ttl: '6h',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    // Broadcast real-time app notification via Pusher across all devices & PWA
    try {
      const pusher = getPusherServer();
      if (pusher) {
        pusher.trigger('rooms-global', 'space-joined', {
          roomName,
          channelId: roomName,
          channelName: body.channelName || roomName,
          userId: identity,
          username: participantName,
          avatar: session.user.image || '',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (pushErr) {
      console.warn('LiveKit Pusher broadcast notice:', pushErr?.message);
    }

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
      identity,
      name: participantName,
      configured: true,
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate LiveKit token' },
      { status: 500 }
    );
  }
}
