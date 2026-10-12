import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const db = await getDatabase();

    const sessions = await db.collection('rag_sessions')
      .find({ user_id: userId })
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(sessions.map(s => ({
      id: s._id.toString(),
      document_id: s.document_id,
      title: s.title,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })));
  } catch (error) {
    console.error('Sessions fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch sessions' }, { status: 500 });
  }
}
