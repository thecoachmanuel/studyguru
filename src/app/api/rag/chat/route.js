import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateStreamWithFallback } from '@/lib/llm';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { sessionId, documentId, message } = await req.json();

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;
    const db = await getDatabase();

    // 1. Retrieve grounded context
    const contextChunks = await retrieveRelevantChunks({
      query: message,
      documentId,
      userId,
      limit: 4,
    });

    const contextText = contextChunks.length > 0
      ? `Relevant Document Context:\n${contextChunks.join('\n\n---\n\n')}`
      : 'No specific document context found.';

    const systemPrompt = `You are the StudyGuru AI Study Assistant.
You help students understand their study documents, answer questions accurately, and explain complex concepts simply.
Base your answers on the provided document context whenever possible.
If the information is not in the document context, clearly state that while still providing a helpful academic explanation.

${contextText}`;

    // 2. Stream AI response with Gemini -> OpenRouter fallback
    const encoder = new TextEncoder();
    let fullAnswer = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = generateStreamWithFallback({
            prompt: `Student question: ${message}`,
            systemPrompt,
          });

          for await (const chunk of generator) {
            fullAnswer += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Save interaction to session history in MongoDB
          if (sessionId && fullAnswer) {
            try {
              const now = new Date();
              const querySessionId = safeObjectId(sessionId);
              await db.collection('rag_sessions').updateOne(
                { $or: [{ _id: querySessionId }, { id: sessionId }] },
                {
                  $push: {
                    messages: {
                      $each: [
                        { role: 'user', content: message, created_at: now },
                        { role: 'assistant', content: fullAnswer, created_at: now },
                      ],
                    },
                  },
                  $set: { updated_at: now },
                }
              );
            } catch (err) {
              console.error('Error saving chat to session:', err);
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
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process chat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
