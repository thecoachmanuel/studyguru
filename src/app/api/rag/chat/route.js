import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateStreamWithFallback } from '@/lib/llm';

// In-memory cache for common student questions on documents
const chatResponseCache = new Map();
const CHAT_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Detects whether a student is requesting a comprehensive pedagogical lesson
 * (e.g., "teach me the topic", "explain this chapter", "walk me through").
 */
function isTeachingOrBroadQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();
  if (q.length <= 25) return true;
  return /teach|explain.*(topic|subject|material|document|everything|chapter|concept|all)|walk.*through|overview|start|syllabus|what is this|lesson|guide me|summary|introduction/i.test(q);
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const message = body.message || body.question;
    const documentId = body.documentId || body.document_id || body.doc_id;
    const sessionId = body.sessionId || body.session_id;
    const rawHistory = Array.isArray(body.history) ? body.history : [];

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();

    // 1. Resolve Document Context (Whole document text + semantic vector chunks)
    let doc = null;
    let fullDocumentText = '';
    let docTitle = '';

    if (documentId) {
      try {
        const safeDocId = safeObjectId(documentId);
        doc = await db.collection('rag_documents').findOne({
          $or: [{ _id: safeDocId }, { id: documentId }, { document_id: documentId }],
        });

        // If not found directly, check via session
        if (!doc && sessionId) {
          const safeSessId = safeObjectId(sessionId);
          const sess = await db.collection('rag_sessions').findOne({
            $or: [{ _id: safeSessId }, { id: sessionId }, { session_id: sessionId }],
          });
          if (sess?.document_id) {
            doc = await db.collection('rag_documents').findOne({
              $or: [{ _id: safeObjectId(sess.document_id) }, { id: sess.document_id }],
            });
          }
        }
      } catch (docErr) {
        console.warn('Document lookup notice in chat:', docErr.message);
      }
    }

    if (doc) {
      docTitle = doc.original_filename || doc.title || 'Study Material';
      if (doc.extracted_text && typeof doc.extracted_text === 'string') {
        fullDocumentText = doc.extracted_text.trim();
      }
    }

    const isTeachingQuery = isTeachingOrBroadQuery(message);

    // 2. Retrieve relevant semantic chunks
    const chunkSearchQuery = isTeachingQuery
      ? `${message} overview introduction core concepts summary`
      : message;

    const contextChunks = await retrieveRelevantChunks({
      query: chunkSearchQuery,
      documentId: doc?._id?.toString() || documentId,
      userId,
      limit: isTeachingQuery ? 6 : 4,
    });

    // 3. Assemble whole-document context
    let contextText = '';
    if (docTitle) {
      contextText += `Document Title / Subject: ${docTitle}\n\n`;
    }

    if (fullDocumentText) {
      // Provide deep document context: up to 10,000 characters for teaching queries
      const textSlice = isTeachingQuery
        ? fullDocumentText.slice(0, 10000)
        : fullDocumentText.slice(0, 3500);
      contextText += `Document Overview & Core Material:\n${textSlice}\n\n`;
    }

    if (contextChunks.length > 0) {
      contextText += `Relevant Document Passages:\n${contextChunks.join('\n\n---\n\n')}`;
    }

    if (!contextText.trim()) {
      contextText = 'No specific document file attached. Act as an expert academic tutor based on your deep knowledge.';
    }

    // 4. Incorporate multi-turn conversation history
    const formattedHistory = rawHistory
      .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim())
      .slice(-8)
      .map((turn) => `${turn.role === 'user' ? 'Student' : 'Personal Tutor'}: ${turn.content.trim()}`)
      .join('\n\n');

    // 5. Master Academic Personal Tutor System Prompt
    const systemPrompt = `You are StudyGuru AI, a world-class, empathetic, and academically brilliant Personal Tutor.
Your mission is to help the student truly master and understand their study materials with pedagogical excellence, clarity, and confidence.

Study Material Context:
${contextText}

Teaching & Tutoring Guidelines:
1. Act as a True Personal Tutor:
   - Maintain an encouraging, intellectual, friendly, and patient persona.
   - When the student says "teach me the topic", "explain this chapter", "walk me through", or asks broad conceptual questions, NEVER give a brief or dismissive 2-sentence answer. Instead, give a structured, pedagogical masterclass lesson!
2. Pedagogical Lesson Structure (for teaching & conceptual questions):
   - 🌟 **The Big Picture & Intuition**: Start with a relatable real-world analogy or clear big-picture hook so the student instantly understands why the topic exists and matters.
   - 🔍 **Core Concepts & Foundations**: Break the topic down into structured, digestible building blocks. Use clear headings, bullet points, and numbered steps.
   - 🧠 **Key Terminology**: Bold essential terms, definitions, formulas, or theorems (e.g. **Active Recall**, **Newton's Second Law: F = ma**).
   - 💡 **Concrete Walkthrough / Example**: Provide an intuitive, step-by-step example demonstrating how the concept works in practice.
   - 🎯 **Key Takeaway**: A crisp 1-2 sentence golden takeaway.
   - ❓ **Check for Understanding**: Conclude with a friendly check-in question or prompt to test their comprehension and invite the next step (e.g., "Would you like me to walk through a practice problem, or dive deeper into [Concept] next?").
3. Whole-Document Comprehension:
   - Ground your explanations in the provided document concepts, terminology, and themes. You understand the document as a cohesive whole.
   - If the student asks about something outside the document, use your broad academic knowledge while gently connecting it back to their study material.
4. Clean Formatting:
   - Use beautiful GitHub-flavored Markdown: bold headers, clean lists, and code/math blocks. Never output raw unstructured walls of text.`;

    let userPrompt = '';
    if (formattedHistory) {
      userPrompt += `Previous Conversation Turns:\n${formattedHistory}\n\n`;
    }
    userPrompt += `Current Student Request: ${message}`;

    // Check if client explicitly asks for streaming
    const wantsStream = req.headers.get('accept')?.includes('text/event-stream') || body.stream === true;

    if (wantsStream) {
      const encoder = new TextEncoder();
      let fullAnswer = '';

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const generator = generateStreamWithFallback({
              prompt: userPrompt,
              systemPrompt,
            });

            for await (const chunk of generator) {
              fullAnswer += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // Zero MongoDB storage waste: do NOT push messages into MongoDB!
            // Messages are safely stored on the user's device (IndexedDB/localStorage).
            // Only update session timestamp if sessionId is provided.
            if (sessionId) {
              try {
                const querySessionId = safeObjectId(sessionId);
                await db.collection('rag_sessions').updateOne(
                  { $or: [{ _id: querySessionId }, { id: sessionId }] },
                  { $set: { updated_at: new Date() } }
                );
              } catch (err) {
                console.warn('Session timestamp touch notice:', err.message);
              }
            }

            controller.close();
          } catch (streamError) {
            console.error('Stream processing error:', streamError);
            controller.error(streamError);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    // Default JSON response expected by RightPanel.jsx apiRequest
    const normalizedQuestion = message.trim().toLowerCase();
    const chatCacheKey = `${documentId || 'general'}:${normalizedQuestion}`;
    const cachedEntry = chatResponseCache.get(chatCacheKey);
    if (cachedEntry && Date.now() - cachedEntry.time < CHAT_CACHE_TTL && rawHistory.length === 0) {
      return NextResponse.json({
        answer: cachedEntry.answer,
        success: true,
        cached: true,
      });
    }

    let fullAnswer = '';
    const generator = generateStreamWithFallback({
      prompt: userPrompt,
      systemPrompt,
    });

    for await (const chunk of generator) {
      fullAnswer += chunk;
    }

    if (fullAnswer.trim()) {
      chatResponseCache.set(chatCacheKey, {
        answer: fullAnswer,
        time: Date.now(),
      });
    }

    if (!fullAnswer.trim()) {
      fullAnswer = 'I reviewed your study materials, but could not formulate a complete answer. Please rephrase your question or ask me to explain a specific topic.';
    }

    // Zero MongoDB storage waste: do NOT push messages into MongoDB!
    // Messages are safely stored on the user's device (IndexedDB/localStorage with 7-day cookie TTL).
    if (sessionId) {
      try {
        const querySessionId = safeObjectId(sessionId);
        await db.collection('rag_sessions').updateOne(
          { $or: [{ _id: querySessionId }, { id: sessionId }] },
          { $set: { updated_at: new Date() } }
        );
      } catch (err) {
        console.warn('Session timestamp touch notice:', err.message);
      }
    }

    return NextResponse.json({
      answer: fullAnswer,
      success: true,
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    );
  }
}
