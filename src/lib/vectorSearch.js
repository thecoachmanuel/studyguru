import { getDatabase } from '@/lib/mongodb';
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
  if (userId && !serverId) filter.user_id = userId;

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
  const chunks = await db.collection('rag_chunks').find(filter).toArray();
  if (chunks.length === 0) return [];

  if (queryEmbedding.length > 0) {
    const scored = chunks.map((chunk) => ({
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.content);
  }

  // Keyword match fallback if embeddings are unavailable
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const keywordScored = chunks.map((chunk) => {
    const text = chunk.content.toLowerCase();
    const score = queryWords.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
    return { content: chunk.content, score };
  });

  keywordScored.sort((a, b) => b.score - a.score);
  return keywordScored.slice(0, limit).map((s) => s.content);
}
