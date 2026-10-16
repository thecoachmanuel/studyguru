import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import {
  addOrUpdateParticipant,
  removeParticipant,
  updateParticipantState,
  getChannelParticipants,
  popPendingSignals,
  broadcastHandRaise,
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

    let userDoc = null;
    try {
      const db = await getDatabase();
      userDoc = await db.collection('users').findOne({
        $or: [{ _id: safeObjectId(session.user.id) }, { id: session.user.id }],
      });
    } catch {}

    const resolvedName =
      body.userName ||
      body.name ||
      userDoc?.name ||
      userDoc?.username ||
      session.user.name ||
      session.user.email?.split('@')[0] ||
      'Study Partner';

    const resolvedUsername =
      body.username ||
      userDoc?.username ||
      session.user.username ||
      session.user.email?.split('@')[0] ||
      resolvedName;

    const resolvedAvatar =
      body.avatar_url ||
      userDoc?.avatar_url ||
      userDoc?.image ||
      session.user.image ||
      null;

    const user = {
      id: session.user.id,
      name: resolvedName,
      username: resolvedUsername,
      full_name: resolvedName,
      email: session.user.email,
      image: resolvedAvatar,
      avatar_url: resolvedAvatar,
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
        userName: resolvedName,
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

    if (action === 'raise-hand') {
      await broadcastHandRaise({
        channelId,
        userId: session.user.id,
        userName: resolvedName,
        raised: Boolean(body.raised),
      });
      return NextResponse.json({ success: true, raised: Boolean(body.raised) });
    }

    if (action === 'heartbeat') {
      await updateParticipantState({
        channelId,
        userId: session.user.id,
        touchHeartbeat: true,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'peer-disconnected') {
      const targetUserId = body.targetUserId ? String(body.targetUserId) : null;
      if (targetUserId) {
        await removeParticipant({
          channelId,
          userId: targetUserId,
          serverId,
        });
        return NextResponse.json({ success: true, removed: targetUserId });
      }
      return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });
    }

    if (action === 'promote-speaker') {
      const targetUserId = body.targetUserId ? String(body.targetUserId) : null;
      if (targetUserId) {
        try {
          const { getPusherServer } = await import('@/lib/pusherServer');
          const pusher = getPusherServer();
          await pusher.trigger(`voice-channel-${channelId}`, 'promoted-to-speaker', {
            targetUserId,
            promotedBy: session.user.id,
            promotedByName: resolvedName,
          });
        } catch (pErr) {
          console.warn('Error broadcasting promote-speaker:', pErr.message);
        }
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/channels/[channelId]/voice:', error);
    return NextResponse.json({ error: error.message || 'Failed to update voice status' }, { status: 500 });
  }
}
