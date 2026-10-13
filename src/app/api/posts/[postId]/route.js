import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const postId = resolvedParams?.postId;
    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { text, content, tag, attachmentUrl } = body;
    const updateText = text !== undefined ? text : content;

    if (typeof updateText !== 'string' || !updateText.trim()) {
      return NextResponse.json({ error: 'Post content cannot be empty' }, { status: 400 });
    }

    const db = await getDatabase();
    const userId = session.user.id;
    const safeId = safeObjectId(postId);

    const post = await db.collection('posts').findOne({
      $or: [{ _id: safeId }, { id: postId }],
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const authorMatch =
      String(post.author_id) === String(userId) ||
      String(post.user_id) === String(userId) ||
      (post.author && String(post.author.id) === String(userId));

    if (!authorMatch) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own posts' }, { status: 403 });
    }

    const updateFields = {
      content: updateText.trim(),
      updated_at: new Date(),
    };
    if (tag) updateFields.tag = tag;
    if (attachmentUrl !== undefined) updateFields.attachment_url = attachmentUrl;

    await db.collection('posts').updateOne(
      { _id: post._id },
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        ...updateFields,
        text: updateFields.content,
        id: post._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: error.message || 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const postId = resolvedParams?.postId;
    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const userId = session.user.id;
    const safeId = safeObjectId(postId);

    const post = await db.collection('posts').findOne({
      $or: [{ _id: safeId }, { id: postId }],
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const authorMatch =
      String(post.author_id) === String(userId) ||
      String(post.user_id) === String(userId) ||
      (post.author && String(post.author.id) === String(userId));

    if (!authorMatch) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own posts' }, { status: 403 });
    }

    await db.collection('posts').deleteOne({ _id: post._id });
    await db.collection('comments').deleteMany({ post_id: postId });

    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete post' }, { status: 500 });
  }
}
