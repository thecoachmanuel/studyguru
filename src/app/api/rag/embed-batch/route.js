import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { GoogleGenAI } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      documentId,
      batchIndex,
      totalBatches,
      chunks, // Array of { index, content }
      serverId = null,
    } = await req.json();

    if (!documentId || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { error: 'documentId and chunks array are required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const db = await getDatabase();

    // Generate embeddings for the batch
    let embeddedChunks = [];

    if (ai) {
      // Embed in parallel with Gemini
      const embedPromises = chunks.map(async (chunk) => {
        try {
          const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: chunk.content,
          });
          const values = response?.embedding?.values || [];
          return {
            document_id: documentId,
            user_id: userId,
            server_id: serverId,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: values,
            created_at: new Date(),
          };
        } catch (err) {
          console.error(`Error embedding chunk ${chunk.index}:`, err);
          return {
            document_id: documentId,
            user_id: userId,
            server_id: serverId,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: [],
            created_at: new Date(),
          };
        }
      });

      embeddedChunks = await Promise.all(embedPromises);
    } else {
      // Mock / fallback if API key is not yet set
      embeddedChunks = chunks.map((chunk) => ({
        document_id: documentId,
        user_id: userId,
        server_id: serverId,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: [],
        created_at: new Date(),
      }));
    }

    // Bulk insert into rag_chunks collection
    if (embeddedChunks.length > 0) {
      await db.collection('rag_chunks').insertMany(embeddedChunks);
    }

    // Check if this was the final batch
    const isComplete = batchIndex + 1 >= totalBatches;
    if (isComplete) {
      const queryDocId = safeObjectId(documentId);
      await db.collection('rag_documents').updateOne(
        { $or: [{ _id: queryDocId }, { id: documentId }] },
        {
          $set: {
            status: 'ready',
            chunk_count: (batchIndex * chunks.length) + chunks.length,
            updated_at: new Date(),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      batchIndex,
      totalBatches,
      processedChunks: chunks.length,
      isComplete,
    });
  } catch (error) {
    console.error('Batch embedding error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to embed chunk batch' },
      { status: 500 }
    );
  }
}
