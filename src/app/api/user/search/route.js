import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim();

    const db = await getDatabase();

    const excludeFilter = {
      $and: [
        { _id: { $ne: safeObjectId(currentUserId) } },
        { id: { $ne: currentUserId } },
      ],
    };

    let filter = excludeFilter;
    if (query) {
      filter = {
        $and: [
          excludeFilter,
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { username: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } },
              { major: { $regex: query, $options: 'i' } },
            ],
          },
        ],
      };
    }

    const users = await db.collection('users')
      .find(filter)
      .limit(30)
      .toArray();

    const formatted = users.map((u) => ({
      id: u._id ? u._id.toString() : u.id,
      name: u.name || u.username || 'Scholar',
      username: u.username || (u.name ? u.name.toLowerCase().replace(/\s+/g, '_') : 'scholar'),
      avatar_url: u.avatar_url || u.image || null,
      subject: u.major || u.school || 'Study Partner',
      followersCount: typeof u.followers_count === 'number' ? u.followers_count : 0,
      online: false,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: error.message || 'Failed to search users' }, { status: 500 });
  }
}
