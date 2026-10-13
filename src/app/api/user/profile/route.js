import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('userId');
    const targetUserId = queryUserId || session.user.id;
    const isSelf = !queryUserId || queryUserId === session.user.id;

    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(targetUserId) }, { id: targetUserId }],
    });

    if (!userDoc) {
      const fallbackName = isSelf ? (session.user.name || 'Scholar') : 'Scholar';
      return NextResponse.json({
        id: targetUserId,
        name: fallbackName,
        username: fallbackName.toLowerCase().replace(/\s+/g, '_'),
        email: isSelf ? session.user.email : null,
        avatar_url: isSelf ? (session.user.image || null) : null,
        banner_url: null,
        bio: '📚 Studying & collaborating on StudyCord · Always open to join study rooms & exam drills!',
        major: 'Computer Science & AI',
        school: 'University',
        followers_count: 0,
        following_count: 0,
        study_hours: 0,
        day_streak: 1,
      });
    }

    return NextResponse.json({
      id: userDoc._id ? userDoc._id.toString() : userDoc.id,
      name: userDoc.name || (isSelf ? session.user.name : 'Scholar') || 'Scholar',
      username: userDoc.username || userDoc.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
      email: isSelf ? (userDoc.email || session.user.email) : null,
      avatar_url: userDoc.avatar_url || userDoc.image || (isSelf ? session.user.image : null),
      banner_url: userDoc.banner_url || null,
      bio: userDoc.bio || '📚 Studying & collaborating on StudyCord · Always open to join study rooms & exam drills!',
      major: userDoc.major || 'Computer Science & AI',
      school: userDoc.school || 'University',
      followers_count: typeof userDoc.followers_count === 'number' ? userDoc.followers_count : 0,
      following_count: typeof userDoc.following_count === 'number' ? userDoc.following_count : 0,
      study_hours: typeof userDoc.study_hours === 'number' ? userDoc.study_hours : 0,
      day_streak: typeof userDoc.day_streak === 'number' ? userDoc.day_streak : 1,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const { name, username, bio, avatar_url, banner_url, major, school } = body;

    const db = await getDatabase();
    const updateDoc = {};

    if (name !== undefined) updateDoc.name = String(name).trim();
    if (username !== undefined) updateDoc.username = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (bio !== undefined) updateDoc.bio = String(bio).trim();
    if (avatar_url !== undefined) updateDoc.avatar_url = avatar_url;
    if (banner_url !== undefined) updateDoc.banner_url = banner_url;
    if (major !== undefined) updateDoc.major = String(major).trim();
    if (school !== undefined) updateDoc.school = String(school).trim();
    updateDoc.updated_at = new Date();

    await db.collection('users').updateOne(
      { $or: [{ _id: safeObjectId(userId) }, { id: userId }] },
      { $set: updateDoc },
      { upsert: true }
    );

    const updatedUser = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const finalAvatar = updatedUser.avatar_url || updatedUser.image || session.user.image || null;
    const finalName = updatedUser.name || session.user.name || 'Scholar';
    const finalUsername = updatedUser.username || finalName.toLowerCase().replace(/\s+/g, '_');
    const finalBio = updatedUser.bio || '';

    // Immediately propagate updated avatar, name, and bio to all older posts authored by this user
    try {
      await db.collection('posts').updateMany(
        {
          $or: [
            { 'author.id': userId },
            { 'author.id': safeObjectId(userId) },
            { author_id: userId },
            { author_id: safeObjectId(userId) },
          ],
        },
        {
          $set: {
            'author.avatar_url': finalAvatar,
            'author.name': finalName,
            'author.username': finalUsername,
            'author.bio': finalBio,
            author_avatar: finalAvatar,
            author_name: finalName,
            author_username: finalUsername,
            author_bio: finalBio,
          },
        }
      );
    } catch (postSyncErr) {
      console.warn('Post author sync notice:', postSyncErr.message);
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser._id ? updatedUser._id.toString() : updatedUser.id,
        name: finalName,
        username: finalUsername,
        email: updatedUser.email || session.user.email,
        avatar_url: finalAvatar,
        banner_url: updatedUser.banner_url,
        bio: finalBio,
        major: updatedUser.major || 'Computer Science & AI',
        school: updatedUser.school || 'University',
        followers_count: typeof updatedUser.followers_count === 'number' ? updatedUser.followers_count : 0,
        following_count: typeof updatedUser.following_count === 'number' ? updatedUser.following_count : 0,
        study_hours: typeof updatedUser.study_hours === 'number' ? updatedUser.study_hours : 0,
        day_streak: typeof updatedUser.day_streak === 'number' ? updatedUser.day_streak : 1,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}
