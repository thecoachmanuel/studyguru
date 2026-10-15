import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  addOrUpdateParticipant,
  removeParticipant,
  updateParticipantState,
  getChannelParticipants,
  popPendingSignals,
} from '@/lib/voiceStore';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    const url = new URL(req.url);
    const pollSignals = url.searchParams.get('pollSignals') === 'true';

    const participants = await getChannelParticipants(channelId);
    const signals = pollSignals ? popPendingSignals(session.user.id) : [];

    return NextResponse.json({
      participants,
      signals,
    });
  } catch (error) {
    console.error('Error in GET /api/channels/[channelId]/voice:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch voice data' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    const body = await req.json().catch(() => ({}));
    const { action = 'join', serverId, isMuted } = body;

    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };

    if (action === 'join') {
      const participant = await addOrUpdateParticipant({
        channelId,
        serverId,
        user,
        isMuted: Boolean(isMuted),
      });
      return NextResponse.json({ success: true, participant });
    }

    if (action === 'leave') {
      await removeParticipant({
        channelId,
        userId: session.user.id,
        userName: session.user.name,
        serverId,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'mute') {
      const participant = await updateParticipantState({
        channelId,
        userId: session.user.id,
        isMuted: Boolean(isMuted),
      });
      return NextResponse.json({ success: true, participant });
    }

    if (action === 'heartbeat') {
      await updateParticipantState({
        channelId,
        userId: session.user.id,
        touchHeartbeat: true,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/channels/[channelId]/voice:', error);
    return NextResponse.json({ error: error.message || 'Failed to update voice status' }, { status: 500 });
  }
}
