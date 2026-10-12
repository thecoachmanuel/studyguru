import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();
    const querySessionId = safeObjectId(sessionId);

    const studySession = await db.collection('rag_sessions').findOne({
      $or: [{ _id: querySessionId }, { id: sessionId }],
      user_id: userId,
    });

    if (!studySession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Also fetch associated document metadata if exists
    let document = null;
    if (studySession.document_id) {
      try {
        const queryDocId = safeObjectId(studySession.document_id);
        document = await db.collection('rag_documents').findOne({
          $or: [{ _id: queryDocId }, { id: studySession.document_id }],
        });
      } catch {}
    }

    return NextResponse.json({
      id: studySession._id.toString(),
      document_id: studySession.document_id,
      title: studySession.title,
      messages: studySession.messages || [],
      created_at: studySession.created_at,
      updated_at: studySession.updated_at,
      document: document ? {
        id: document._id.toString(),
        filename: document.original_filename,
        detected_type: document.detected_type,
        status: document.status,
      } : null,
    });
  } catch (error) {
    console.error('Session get error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch session' }, { status: 500 });
  }
}
