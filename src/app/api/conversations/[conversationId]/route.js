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

    const { conversationId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();

    const convObjId = safeObjectId(conversationId);
    const conv = await db.collection('conversations').findOne({
      $or: [{ _id: convObjId }, { id: conversationId }],
      participants: userId,
    });

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const otherId = conv.participants.find((p) => p !== userId);
    const recipient = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(otherId) }, { id: otherId }],
    });

    return NextResponse.json({
      id: conv._id.toString(),
      participants: conv.participants,
      status: conv.status || 'accepted',
      requested_by: conv.requested_by || null,
      last_message: conv.last_message || null,
      other_user: {
        id: otherId,
        name: recipient?.name || recipient?.username || 'Study Partner',
        username: recipient?.username || recipient?.name || 'partner',
        avatar_url: recipient?.avatar_url || recipient?.image || null,
      },
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = await params;
    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const { action } = body; // 'accept' | 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Action must be accept or decline' }, { status: 400 });
    }

    const db = await getDatabase();
    const convObjId = safeObjectId(conversationId);
    const conv = await db.collection('conversations').findOne({
      $or: [{ _id: convObjId }, { id: conversationId }],
      participants: userId,
    });

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    await db.collection('conversations').updateOne(
      { $or: [{ _id: convObjId }, { id: conversationId }] },
      { $set: { status: nextStatus, updated_at: new Date() } }
    );

    // Notify peers via Pusher
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger(`conversation-${conversationId}`, 'request-status', {
          conversationId,
          status: nextStatus,
          updated_by: userId,
        });
      }
    } catch (e) {
      console.warn('Pusher request-status broadcast error:', e.message);
    }

    return NextResponse.json({
      success: true,
      conversationId,
      status: nextStatus,
    });
  } catch (error) {
    console.error('Error updating conversation request:', error);
    return NextResponse.json({ error: error.message || 'Failed to update request' }, { status: 500 });
  }
}
