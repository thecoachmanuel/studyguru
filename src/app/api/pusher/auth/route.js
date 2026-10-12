import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');

    if (!socketId || !channelName) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
    }

    const pusherServer = getPusherServer();
    
    // Presence channel user data
    const presenceData = {
      user_id: session.user.id,
      user_info: {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json({ error: error.message || 'Pusher auth failed' }, { status: 500 });
  }
}
