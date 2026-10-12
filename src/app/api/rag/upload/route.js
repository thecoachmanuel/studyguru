import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';
import { GoogleGenAI } from '@google/genai';
import { chunkText } from '@/lib/clientDocumentParser';

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    const userId = session.user.id;
    const db = await getDatabase();
    const now = new Date();

    // Read text content
    let extractedText = '';
    if (ext === 'txt') {
      extractedText = await file.text();
    } else {
      // For larger or binary docs, fallback text extraction or notify client to use zero-timeout client parser
      extractedText = await file.text().catch(() => '');
    }

    const chunks = chunkText(extractedText);

    // Save document metadata
    const docRes = await db.collection('rag_documents').insertOne({
      user_id: userId,
      original_filename: filename,
      detected_type: ext,
      size_bytes: file.size,
      chunk_count: chunks.length,
      status: chunks.length > 0 ? 'ready' : 'processing',
      created_at: now,
      updated_at: now,
    });
    const documentId = docRes.insertedId.toString();

    // Create session
    const sessionRes = await db.collection('rag_sessions').insertOne({
      user_id: userId,
      document_id: documentId,
      title: filename,
      messages: [],
      created_at: now,
      updated_at: now,
    });
    const sessionId = sessionRes.insertedId.toString();

    // If small text file, embed initial chunks directly
    if (chunks.length > 0 && chunks.length <= 10 && ai) {
      try {
        const embeddedChunks = await Promise.all(
          chunks.map(async (text, idx) => {
            const res = await ai.models.embedContent({
              model: 'text-embedding-004',
              contents: text,
            });
            return {
              document_id: documentId,
              user_id: userId,
              chunk_index: idx,
              content: text,
              embedding: res?.embedding?.values || [],
              created_at: now,
            };
          })
        );
        await db.collection('rag_chunks').insertMany(embeddedChunks);
      } catch (embedErr) {
        console.warn('Initial embedding warning:', embedErr);
      }
    }

    return NextResponse.json({
      document_id: documentId,
      session_id: sessionId,
      filename,
      status: 'ready',
      chunk_count: chunks.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'File upload failed' },
      { status: 500 }
    );
  }
}
