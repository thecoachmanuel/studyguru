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

    const { postId } = await params;
    const userId = String(session.user.id);
    const body = await req.json().catch(() => ({}));
    const { text = '' } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400 });
    }

    const db = await getDatabase();
    const postCol = db.collection('posts');

    const postObjId = safeObjectId(postId);
    const post = await postCol.findOne({
      $or: [{ _id: postObjId }, { id: postId }],
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const now = new Date();
    const commentId = `c-${Date.now()}`;
    const newComment = {
      id: commentId,
      user_id: userId,
      author: {
        id: userId,
        name: userDoc?.name || session.user.name || 'Scholar',
        username: userDoc?.username || userDoc?.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
        avatar_url: userDoc?.avatar_url || session.user.image || null,
      },
      text: text.trim(),
      likes: 0,
      liked_by: [],
      created_at: now,
    };

    const nextCount = (post.comments_count || (post.comments?.length || 0)) + 1;

    await postCol.updateOne(
      { $or: [{ _id: postObjId }, { id: postId }] },
      {
        $push: { comments: newComment },
        $set: { comments_count: nextCount },
      }
    );

    const formattedComment = {
      id: newComment.id,
      author: newComment.author,
      text: newComment.text,
      timestamp: 'Just now',
      likes: 0,
      liked: false,
    };

    // Broadcast real-time comment via Pusher
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger('feed', 'new-comment', {
          postId,
          comment: formattedComment,
          commentsCount: nextCount,
        });
      }
    } catch (pushErr) {
      console.warn('Pusher broadcast warning for new comment:', pushErr.message);
    }

    return NextResponse.json({
      success: true,
      comment: formattedComment,
      commentsCount: nextCount,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: error.message || 'Failed to add comment' }, { status: 500 });
  }
}
