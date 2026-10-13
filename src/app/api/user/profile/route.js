import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    if (!userDoc) {
      return NextResponse.json({
        id: userId,
        name: session.user.name || 'Scholar',
        username: session.user.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
        email: session.user.email,
        avatar_url: session.user.image || null,
        banner_url: null,
        bio: '📚 Passionate student on StudyCord · Always open to collaborate on projects & exam drills!',
        major: 'Computer Science & AI',
        followers_count: 12,
        following_count: 5,
      });
    }

    return NextResponse.json({
      id: userDoc._id ? userDoc._id.toString() : userDoc.id,
      name: userDoc.name || session.user.name || 'Scholar',
      username: userDoc.username || userDoc.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
      email: userDoc.email || session.user.email,
      avatar_url: userDoc.avatar_url || userDoc.image || session.user.image || null,
      banner_url: userDoc.banner_url || null,
      bio: userDoc.bio || '📚 Passionate student on StudyCord · Always open to collaborate on projects & exam drills!',
      major: userDoc.major || 'Computer Science & AI',
      school: userDoc.school || 'University',
      followers_count: typeof userDoc.followers_count === 'number' ? userDoc.followers_count : 14,
      following_count: typeof userDoc.following_count === 'number' ? userDoc.following_count : 6,
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
    if (username !== undefined) updateDoc.username = String(username).trim();
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

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser._id ? updatedUser._id.toString() : updatedUser.id,
        name: updatedUser.name || session.user.name,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url || updatedUser.image,
        banner_url: updatedUser.banner_url,
        bio: updatedUser.bio,
        major: updatedUser.major,
        school: updatedUser.school,
        followers_count: updatedUser.followers_count || 14,
        following_count: updatedUser.following_count || 6,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}
