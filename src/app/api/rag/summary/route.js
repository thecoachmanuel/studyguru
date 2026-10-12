import { auth } from '@/auth';
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

    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = session.user.id;

    // Retrieve high-level chunks across document
    const chunks = await retrieveRelevantChunks({
      query: 'summary overview main concepts core topics conclusions',
      documentId,
      userId,
      limit: 8,
    });

    const contextText = chunks.join('\n\n---\n\n');
    const encoder = new TextEncoder();

    const prompt = `You are the StudyGuru AI Study Assistant.
Generate a structured, student-friendly academic study summary based on the following document content:

${contextText}

Structure your response with:
1. **Overview & Objective**
2. **Key Concepts Explained**
3. **Important Definitions & Terms**
4. **Key Takeaways for Revision**`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = generateStreamWithFallback({ prompt });
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
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
    console.error('Summary error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
