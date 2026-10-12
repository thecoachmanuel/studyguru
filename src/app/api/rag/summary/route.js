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

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const isRegenerate = Boolean(body.regenerate || body.forceRefresh);

    // High-concurrency cache hit: Serve existing summary immediately without burning API quota
    if (!isRegenerate) {
      try {
        const cached = await db.collection('rag_study_outputs').findOne({
          document_id: documentId,
          output_type: 'summary',
        });
        if (cached?.content?.executive_summary) {
          const isDummy =
            cached.content.executive_summary?.toLowerCase().includes('core academic material') ||
            cached.content.key_points?.some((p) => p.toLowerCase().includes('active recall'));
          if (!isDummy) {
            return NextResponse.json(cached.content);
          } else {
            await db.collection('rag_study_outputs').deleteOne({ _id: cached._id });
          }
        }
      } catch (cacheErr) {
        console.warn('Summary cache lookup notice:', cacheErr.message);
      }
    }

    // Retrieve high-level chunks across document
    const chunks = await retrieveRelevantChunks({
      query: 'summary overview main concepts core topics conclusions',
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

    const prompt = `Based ONLY on the document text provided below, generate a structured academic study summary.
Do NOT use generic placeholder text. Every point, concept, and summary sentence must accurately reflect the document.

Return ONLY a valid JSON object with this exact structure:
{
  "executive_summary": "Comprehensive overview of the document (2-3 paragraphs)",
  "key_concepts": [
    { "concept": "Concept Name", "description": "Accurate explanation from the text" }
  ],
  "key_points": [
    "Important takeaway 1",
    "Important takeaway 2",
    "Important takeaway 3"
  ]
}

Document Content:
${contextText.slice(0, 12000)}`;

    let summary = null;
    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an academic study assistant that outputs strictly valid JSON matching the exact requested summary schema based on the document.',
        json: true,
      });

      const parsed = extractJson(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        summary = parsed;
      }
    } catch (err) {
      console.error('Summary generation error:', err.message);
      return NextResponse.json(
        { error: 'Failed to generate summary: ' + err.message },
        { status: 502 }
      );
    }

    if (!summary || typeof summary !== 'object' || !summary.executive_summary) {
      return NextResponse.json(
        { error: 'AI could not generate a summary from this document. Please try again or click Regenerate.' },
        { status: 502 }
      );
    }

    if (!summary.executive_summary || typeof summary.executive_summary !== 'string') {
      summary.executive_summary = 'Study document overview and academic revision summary.';
    }

    if (!Array.isArray(summary.key_concepts) || summary.key_concepts.length === 0) {
      summary.key_concepts = [
        { concept: 'Key Topic', description: 'Primary academic topic covered in this document.' },
      ];
    } else {
      // Normalize each concept to ensure { concept, description } strings
      summary.key_concepts = summary.key_concepts.map((c, i) => ({
        concept: String(c.concept || c.title || c.name || `Concept ${i + 1}`),
        description: String(c.description || c.explanation || c.desc || 'Key academic principle.'),
      }));
    }

    if (!Array.isArray(summary.key_points) || summary.key_points.length === 0) {
      summary.key_points = ['Review core sections carefully.', 'Practice spaced repetition.'];
    } else {
      summary.key_points = summary.key_points.map(p => (typeof p === 'string' ? p : JSON.stringify(p)));
    }

    // Persist to study outputs cache for instant access by any subsequent viewer
    try {
      await db.collection('rag_study_outputs').updateOne(
        { document_id: documentId, output_type: 'summary' },
        {
          $set: {
            document_id: documentId,
            output_type: 'summary',
            content: summary,
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (saveErr) {
      console.warn('Failed to cache generated summary:', saveErr.message);
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
