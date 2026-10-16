import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    let db = null;
    try {
      db = await getDatabase();
    } catch {
      // Offline / demo mode
    }

    if (!db) {
      return NextResponse.json([
        {
          role: 'owner',
          user_id: 'user-adewale',
          joined_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          profiles: {
            id: 'user-adewale',
            username: 'adewale',
            name: 'Adewale Olaitan',
            full_name: 'Adewale Olaitan',
            avatar_url: null,
            email: 'adewale@studycord.me',
          },
        },
        {
          role: 'admin',
          user_id: 'user-tutor',
          joined_at: new Date(Date.now() - 86400000 * 20).toISOString(),
          profiles: {
            id: 'user-tutor',
            username: 'studycord_tutor',
            name: 'StudyCord AI Tutor',
            full_name: 'StudyCord AI Tutor',
            avatar_url: null,
            email: 'tutor@studycord.me',
          },
        },
        {
          role: 'member',
          user_id: session.user.id,
          joined_at: new Date().toISOString(),
          profiles: {
            id: session.user.id,
            username: session.user.name || session.user.email?.split('@')[0] || 'Demo Scholar',
            name: session.user.name || 'Demo Scholar',
            full_name: session.user.name || 'Demo Scholar',
            avatar_url: session.user.image || null,
            email: session.user.email,
          },
        },
        {
          role: 'member',
          user_id: 'user-alex',
          joined_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          profiles: {
            id: 'user-alex',
            username: 'alex_chen',
            name: 'Alex Chen',
            full_name: 'Alex Chen',
            avatar_url: null,
            email: 'alex@studycord.me',
          },
        },
      ]);
    }

    const members = await db.collection('server_members')
      .find({ server_id: serverId })
      .toArray();

    const userIds = members.map(m => safeObjectId(m.user_id));

    const users = await db.collection('users')
      .find({
        $or: [
          { _id: { $in: userIds } },
          { id: { $in: members.map(m => m.user_id) } },
        ],
      })
      .toArray();

    const userMap = new Map();
    users.forEach(u => {
      userMap.set(u._id.toString(), u);
      if (u.id) userMap.set(String(u.id), u);
    });

    const formatted = members.map(m => {
      const user = userMap.get(m.user_id);
      return {
        role: m.role || 'member',
        user_id: m.user_id,
        joined_at: m.joined_at,
        profiles: {
          id: m.user_id,
          username: user?.username || user?.name || 'Member',
          name: user?.name || user?.username || 'Member',
          full_name: user?.name || user?.username || 'Member',
          avatar_url: user?.avatar_url || user?.image || null,
          email: user?.email || '',
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching server members:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch members' }, { status: 500 });
  }
}
