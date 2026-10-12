import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateContentWithFallback, extractJson } from '@/lib/llm';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const documentId = body.documentId || body.doc_id || body.document_id;
    const count = body.count || 6;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const isRegenerate = Boolean(body.regenerate || body.forceRefresh);

    // High-concurrency cache hit: Serve existing flashcards immediately
    if (!isRegenerate) {
      try {
        const cached = await db.collection('rag_study_outputs').findOne({
          document_id: documentId,
          output_type: 'flashcards',
        });
        if (Array.isArray(cached?.content) && cached.content.length > 0) {
          const isDummy = cached.content.some((c) =>
            c.question?.toLowerCase().includes('active recall') ||
            c.question?.toLowerCase().includes('exam preparation')
          );
          if (!isDummy) {
            return NextResponse.json({ flashcards: cached.content });
          } else {
            // Delete corrupt dummy cache entry
            await db.collection('rag_study_outputs').deleteOne({ _id: cached._id });
          }
        }
      } catch (cacheErr) {
        console.warn('Flashcard cache lookup notice:', cacheErr.message);
      }
    }

    const chunks = await retrieveRelevantChunks({
      query: 'key concepts definitions principles formulas facts study flashcards vocabulary important terms',
      documentId,
      userId,
      limit: 8,
    });

    let contextText = chunks.length > 0 ? chunks.join('\n\n---\n\n') : '';

    // If chunks are empty, directly fetch document text from MongoDB
    if (!contextText || contextText.trim().length < 20) {
      const { safeObjectId } = await import('@/lib/mongodb');
      const safeId = safeObjectId(documentId);
      const doc = await db.collection('rag_documents').findOne({
        $or: [{ _id: safeId }, { id: documentId }, { document_id: documentId }],
      });
      if (doc?.extracted_text) {
        contextText = doc.extracted_text;
      } else {
        const sess = await db.collection('rag_sessions').findOne({
          $or: [{ _id: safeId }, { id: documentId }, { session_id: documentId }],
        });
        if (sess?.document_id) {
          const sessDoc = await db.collection('rag_documents').findOne({
            $or: [{ _id: safeObjectId(sess.document_id) }, { id: sess.document_id }],
          });
          if (sessDoc?.extracted_text) {
            contextText = sessDoc.extracted_text;
          }
        }
      }
    }

    if (!contextText || contextText.trim().length < 10) {
      return NextResponse.json(
        { error: 'No readable study document text found. Please upload or select a document first.' },
        { status: 400 }
      );
    }

    const prompt = `Based ONLY on the study document text provided below, generate ${count} comprehensive educational flashcards covering the key concepts, terms, definitions, and facts in the text.
Do NOT use generic filler text or placeholder questions. Every single card must be directly based on the document text.

Return ONLY a valid JSON array matching this exact structure:
[
  {
    "question": "Specific question or key concept from the text",
    "answer": "Accurate, concise explanation or definition from the text"
  }
]

Document Text:
${contextText.slice(0, 12000)}`;

    let flashcards = [];
    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an academic study assistant that outputs strictly valid JSON arrays of flashcards with "question" and "answer" properties directly based on the user document.',
        json: true,
      });

      const parsed = extractJson(text);
      const rawCards = Array.isArray(parsed)
        ? parsed
        : (parsed?.flashcards || parsed?.cards || parsed?.items || []);

      if (Array.isArray(rawCards) && rawCards.length > 0) {
        flashcards = rawCards.map((card) => {
          const q = card.question || card.front || card.concept || card.title || card.term;
          const a = card.answer || card.back || card.definition || card.description || card.explanation;
          return {
            question: String(q || '').trim(),
            answer: String(a || '').trim(),
          };
        }).filter((card) => card.question && card.answer);
      }
    } catch (llmErr) {
      console.error('Flashcard generation error:', llmErr.message);
      return NextResponse.json(
        { error: 'Failed to generate flashcards: ' + llmErr.message },
        { status: 502 }
      );
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'AI could not extract flashcards from this document. Please try again or click Regenerate.' },
        { status: 502 }
      );
    }

    // Cache generated flashcards in database for high-concurrency reuse
    try {
      await db.collection('rag_study_outputs').updateOne(
        { document_id: documentId, output_type: 'flashcards' },
        {
          $set: {
            document_id: documentId,
            output_type: 'flashcards',
            content: flashcards,
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (saveErr) {
      console.warn('Failed to cache flashcards:', saveErr.message);
    }

    return NextResponse.json({ flashcards });
  } catch (error) {
    console.error('Flashcards error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}
