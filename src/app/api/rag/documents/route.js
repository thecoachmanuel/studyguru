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

    const userId = session.user.id;
    const db = await getDatabase();

    const docs = await db.collection('rag_documents')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    const formatted = docs.map((doc) => ({
      doc_id: doc._id.toString(),
      id: doc._id.toString(),
      filename: doc.original_filename || 'Study Note.pdf',
      title: doc.original_filename || 'Study Note',
      detected_type: doc.detected_type || 'pdf',
      chunksCount: doc.chunk_count || 1,
      size_bytes: doc.size_bytes || 0,
      extractedText: doc.extracted_text || '',
      status: doc.status || 'ready',
      created_at: doc.created_at,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching rag documents:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id') || searchParams.get('docId');

    if (!docId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const objId = safeObjectId(docId);

    // Remove from documents
    await db.collection('rag_documents').deleteOne({
      _id: objId,
      user_id: userId,
    });

    // Remove associated chunks
    await db.collection('rag_chunks').deleteMany({
      $or: [{ document_id: docId }, { doc_id: docId }],
      user_id: userId,
    });

    return NextResponse.json({ success: true, docId });
  } catch (error) {
    console.error('Error deleting rag document:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete document' }, { status: 500 });
  }
}
