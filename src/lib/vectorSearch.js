import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { GoogleGenAI } from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

/**
 * Generate embedding vector for a query string
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedQuery(text) {
  if (!ai) return [];
  try {
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });
    return res?.embedding?.values || [];
  } catch (error) {
    console.error('Error generating query embedding:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two numeric vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve top relevant chunks for a document or server
 * Supports both MongoDB Atlas Vector Search ($vectorSearch) and in-memory cosine fallback
 */
export async function retrieveRelevantChunks({
  query,
  documentId = null,
  serverId = null,
  userId = null,
  limit = 5,
}) {
  const db = await getDatabase();
  const queryEmbedding = await embedQuery(query);

  const filter = {};
  if (documentId) filter.document_id = documentId;
  if (serverId) filter.server_id = serverId;
  if (userId && !serverId && !documentId) filter.user_id = userId;

  // Try Atlas Vector Search aggregation first
  if (queryEmbedding.length > 0) {
    try {
      const atlasResults = await db.collection('rag_chunks').aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit: limit,
            filter: filter,
          },
        },
      ]).toArray();

      if (atlasResults && atlasResults.length > 0) {
        return atlasResults.map((doc) => doc.content);
      }
    } catch {
      // Index not yet created or local MongoDB: gracefully proceed to in-memory cosine similarity
    }
  }

  // Graceful in-memory fallback
  const safeId = safeObjectId(documentId);
  const mongoFilter = {};
  if (documentId) {
    mongoFilter.$or = [
      { document_id: documentId },
      { doc_id: documentId },
      ...(safeId ? [{ document_id: safeId }, { doc_id: safeId }] : []),
    ];
  }
  if (serverId) mongoFilter.server_id = serverId;
  if (userId && !serverId && !documentId) mongoFilter.user_id = userId;

  const chunks = await db.collection('rag_chunks').find(mongoFilter).toArray();
  if (chunks.length === 0) {
    if (documentId) {
      try {
        let doc = await db.collection('rag_documents').findOne({
          $or: [{ _id: safeId }, { id: documentId }, { document_id: documentId }],
        });
        if (!doc) {
          // Check if documentId was passed as session_id
          const session = await db.collection('rag_sessions').findOne({
            $or: [{ _id: safeId }, { id: documentId }, { session_id: documentId }],
          });
          if (session?.document_id) {
            const sessDocId = safeObjectId(session.document_id);
            doc = await db.collection('rag_documents').findOne({
              $or: [{ _id: sessDocId }, { id: session.document_id }, { document_id: session.document_id }],
            });
            const sessionChunks = await db.collection('rag_chunks').find({
              $or: [
                { document_id: session.document_id },
                { doc_id: session.document_id },
                ...(sessDocId ? [{ document_id: sessDocId }, { doc_id: sessDocId }] : []),
              ],
            }).toArray();
            if (sessionChunks.length > 0) {
              return sessionChunks.slice(0, limit).map((c) => c.content);
            }
          }
        }
        if (doc?.extracted_text) {
          return [doc.extracted_text.slice(0, 5000)];
        }
      } catch {}
    }
    return [];
  }

  const hasValidChunkEmbeddings = chunks.some(
    (chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0
  );

  if (queryEmbedding.length > 0 && hasValidChunkEmbeddings) {
    const scored = chunks.map((chunk) => ({
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topScored = scored.filter((s) => s.score > 0.1);
    if (topScored.length > 0) {
      return topScored.slice(0, limit).map((s) => s.content);
    }
  }

  // Keyword match fallback if embeddings are unavailable or not yet computed
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const keywordScored = chunks.map((chunk) => {
    const text = (chunk.content || '').toLowerCase();
    const score = queryWords.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
    return { content: chunk.content, score };
  });

  keywordScored.sort((a, b) => b.score - a.score);
  return keywordScored.slice(0, limit).map((s) => s.content);
}
