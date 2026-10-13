import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messageId } = await params;
    const userId = session.user.id;
    const username = session.user.name || session.user.email?.split('@')[0] || 'User';

    let body = {};
    try {
      body = await req.json();
    } catch {
      try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
      } catch {}
    }

    const { emoji } = body || {};
    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'Valid emoji is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const msgObjectId = safeObjectId(messageId);

    const message = await db.collection('messages').findOne({
      $or: [{ _id: msgObjectId }, { id: messageId }],
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const existingReactions = Array.isArray(message.reactions) ? message.reactions : [];
    
    // Check if user already reacted with this emoji
    const existingIndex = existingReactions.findIndex(
      (r) => r.emoji === emoji && (r.user_id === userId || r.userId === userId)
    );

    let updatedReactions;
    if (existingIndex >= 0) {
      // Toggle OFF: remove reaction
      updatedReactions = existingReactions.filter((_, idx) => idx !== existingIndex);
    } else {
      // Toggle ON: add reaction
      updatedReactions = [
        ...existingReactions,
        {
          emoji,
          user_id: userId,
          username,
          created_at: new Date(),
        },
      ];
    }

    // Update in database
    await db.collection('messages').updateOne(
      { $or: [{ _id: msgObjectId }, { id: messageId }] },
      { $set: { reactions: updatedReactions, updated_at: new Date() } }
    );

    // Broadcast reaction update via Pusher
    try {
      const pusher = getPusherServer();
      await pusher.trigger(`channel-${message.channel_id}`, 'message-reacted', {
        messageId,
        reactions: updatedReactions,
        channelId: message.channel_id,
      });
    } catch (e) {
      console.warn('Pusher broadcast reaction error:', e.message);
    }

    return NextResponse.json({
      success: true,
      messageId,
      reactions: updatedReactions,
    });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
