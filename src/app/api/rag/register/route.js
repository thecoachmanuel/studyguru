import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      filename,
      detectedType,
      sizeBytes,
      chunkCount,
      fileUrl = null,
      serverId = null,
    } = await req.json();

    if (!filename || !detectedType) {
      return NextResponse.json(
        { error: 'Filename and detectedType are required.' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const now = new Date();

    const newDoc = {
      user_id: userId,
      server_id: serverId,
      original_filename: filename,
      detected_type: detectedType,
      size_bytes: sizeBytes || 0,
      chunk_count: chunkCount || 0,
      file_url: fileUrl,
      status: 'processing',
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection('rag_documents').insertOne(newDoc);
    const documentId = result.insertedId.toString();

    // Also auto-create a study session for personal AI
    let sessionId = null;
    if (!serverId) {
      const newSession = {
        user_id: userId,
        document_id: documentId,
        title: filename,
        messages: [],
        created_at: now,
        updated_at: now,
      };
      const sessionRes = await db.collection('rag_sessions').insertOne(newSession);
      sessionId = sessionRes.insertedId.toString();
    }

    return NextResponse.json({
      documentId,
      sessionId,
      status: 'processing',
    }, { status: 201 });
  } catch (error) {
    console.error('Document registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register document' },
      { status: 500 }
    );
  }
}
