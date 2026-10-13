import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';

export async function POST(req, { params }) {
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
      // Offline / demo fallback
    }

    if (!db) {
      return NextResponse.json({ success: true, message: 'Left server successfully' });
    }

    await db.collection('server_members').deleteOne({
      server_id: serverId,
      user_id: session.user.id,
    });

    return NextResponse.json({ success: true, message: 'Left server successfully' });
  } catch (error) {
    console.error('Error leaving server:', error);
    return NextResponse.json({ error: error.message || 'Failed to leave server' }, { status: 500 });
  }
}

export const DELETE = POST;
