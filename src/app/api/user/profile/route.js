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

    // Dynamically calculate accurate followers and following count from follows collection
    const realFollowersCount = await db.collection('follows').countDocuments({
      following_id: targetUserId,
    }).catch(() => 0);

    const realFollowingCount = await db.collection('follows').countDocuments({
      follower_id: targetUserId,
    }).catch(() => 0);

    const docsCount = await db.collection('rag_documents').countDocuments({
      user_id: targetUserId,
    }).catch(() => 0);

    const userPostsCount = await db.collection('posts').countDocuments({
      $or: [{ 'author.id': targetUserId }, { author_id: targetUserId }],
    }).catch(() => 0);

    const dynamicStudyHours = Math.max(8, docsCount * 3 + userPostsCount * 2);

    if (!userDoc) {
      if (isSelf) {
        const fallbackName = session.user.name || 'Scholar';
        return NextResponse.json({
          id: targetUserId,
          name: fallbackName,
          username: fallbackName.toLowerCase().replace(/\s+/g, '_'),
          email: session.user.email,
          avatar_url: session.user.image || null,
          banner_url: null,
          bio: '',
          major: 'Computer Science & AI',
          school: 'University',
          followers_count: realFollowersCount,
          following_count: realFollowingCount,
          study_hours: dynamicStudyHours,
          day_streak: 1,
        });
      }

      // Demo/seed authors fallback checked first for consistent stats
      const demoUsers = {
        'u-sarah': {
          name: 'Sarah Chen',
          username: 'schen_ai',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
          bio: 'Senior studying AI & Computational Neuroscience · Passionate about vector calculus & transformers.',
          followers_count: 42,
          study_hours: 24,
          day_streak: 7,
          following_count: 15,
        },
        'u-alex': {
          name: 'Alex Rivera',
          username: 'arivera_cs',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
          bio: 'Computer Science Major · Building open-source machine learning tooling.',
          followers_count: 31,
          study_hours: 18,
          day_streak: 5,
          following_count: 12,
        },
        'u-jordan': {
          name: 'Jordan Lee',
          username: 'jlee_stats',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
          bio: 'Applied Statistics & Data Science Scholar · Analyzing stochastic calculus.',
          followers_count: 27,
          study_hours: 16,
          day_streak: 4,
          following_count: 14,
        },
        'u-maya': {
          name: 'Maya Patel',
          username: 'mpatel_math',
          avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
          bio: 'Pure Mathematics & Algebra Specialist.',
          followers_count: 38,
          study_hours: 22,
          day_streak: 6,
          following_count: 18,
        },
      };

      if (demoUsers[targetUserId]) {
        const d = demoUsers[targetUserId];
        return NextResponse.json({
          id: targetUserId,
          name: d.name,
          username: d.username,
          email: null,
          avatar_url: d.avatar_url,
          banner_url: null,
          bio: d.bio,
          major: 'Computer Science & AI',
          school: 'University',
          followers_count: d.followers_count + realFollowersCount,
          following_count: d.following_count + realFollowingCount,
          study_hours: d.study_hours,
          day_streak: d.day_streak,
        });
      }

      // Check if this user authored any posts in the posts collection
      const postWithAuthor = await db.collection('posts').findOne({
        $or: [
          { 'author.id': targetUserId },
          { author_id: targetUserId },
          { 'author.username': targetUserId },
        ],
      });

      if (postWithAuthor?.author) {
        const authInfo = postWithAuthor.author;
        const baseFollowers = typeof authInfo.followersCount === 'number'
          ? authInfo.followersCount
          : (typeof authInfo.followers_count === 'number' ? authInfo.followers_count : 12);
        const baseHours = typeof authInfo.study_hours === 'number'
          ? authInfo.study_hours
          : (typeof authInfo.studyHours === 'number' ? authInfo.studyHours : 14);
        const baseStreak = typeof authInfo.day_streak === 'number'
          ? authInfo.day_streak
          : (typeof authInfo.dayStreak === 'number' ? authInfo.dayStreak : 1);

        return NextResponse.json({
          id: targetUserId,
          name: authInfo.name || 'Study Scholar',
          username: authInfo.username || authInfo.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
          email: null,
          avatar_url: authInfo.avatar_url || authInfo.avatar || null,
          banner_url: null,
          bio: authInfo.bio || '',
          major: 'Computer Science & AI',
          school: 'University',
          followers_count: baseFollowers + realFollowersCount,
          following_count: 8 + realFollowingCount,
          study_hours: baseHours,
          day_streak: baseStreak,
        });
      }

      return NextResponse.json({ found: false, error: 'User not found' }, { status: 404 });
    }

    const calculatedFollowers = typeof userDoc.followers_count === 'number' && userDoc.followers_count > 0
      ? userDoc.followers_count
      : realFollowersCount;

    const calculatedFollowing = typeof userDoc.following_count === 'number' && userDoc.following_count > 0
      ? userDoc.following_count
      : realFollowingCount;

    return NextResponse.json({
      id: userDoc._id ? userDoc._id.toString() : userDoc.id,
      name: userDoc.name || (isSelf ? session.user.name : 'Scholar') || 'Scholar',
      username: userDoc.username || userDoc.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
      email: isSelf ? (userDoc.email || session.user.email) : null,
      avatar_url: userDoc.avatar_url || userDoc.image || (isSelf ? session.user.image : null),
      banner_url: userDoc.banner_url || null,
      bio: userDoc.bio || '',
      major: userDoc.major || 'Computer Science & AI',
      school: userDoc.school || 'University',
      followers_count: calculatedFollowers,
      following_count: calculatedFollowing,
      study_hours: typeof userDoc.study_hours === 'number' ? userDoc.study_hours : dynamicStudyHours,
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
