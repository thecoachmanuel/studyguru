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
    const db = await getDatabase();
    const postCol = db.collection('posts');

    const postObjId = safeObjectId(postId);
    const post = await postCol.findOne({
      $or: [{ _id: postObjId }, { id: postId }],
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const likedBy = Array.isArray(post.liked_by) ? post.liked_by.map(String) : [];
    const isCurrentlyLiked = likedBy.includes(userId);

    let nextLiked = false;
    let nextCount = post.likes_count || 0;

    if (isCurrentlyLiked) {
      // Unlike
      nextLiked = false;
      nextCount = Math.max(0, nextCount - 1);
      await postCol.updateOne(
        { $or: [{ _id: postObjId }, { id: postId }] },
        {
          $pull: { liked_by: userId },
          $set: { likes_count: nextCount },
        }
      );
    } else {
      // Like
      nextLiked = true;
      nextCount = nextCount + 1;
      await postCol.updateOne(
        { $or: [{ _id: postObjId }, { id: postId }] },
        {
          $addToSet: { liked_by: userId },
          $set: { likes_count: nextCount },
        }
      );
    }

    // Broadcast like update via Pusher
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger('feed', 'post-liked', {
          postId,
          likes: nextCount,
          userId,
          liked: nextLiked,
        });
      }
    } catch (pushErr) {
      console.warn('Pusher broadcast warning for post like:', pushErr.message);
    }

    return NextResponse.json({
      success: true,
      postId,
      liked: nextLiked,
      likes: nextCount,
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json({ error: error.message || 'Failed to update like' }, { status: 500 });
  }
}
