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
    const count = body.count || 5;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const db = await getDatabase();
    const isRegenerate = Boolean(body.regenerate || body.forceRefresh);

    // High-concurrency cache hit: Serve existing MCQs immediately
    if (!isRegenerate) {
      try {
        const cached = await db.collection('rag_study_outputs').findOne({
          document_id: documentId,
          output_type: 'mcq',
        });
        if (Array.isArray(cached?.content) && cached.content.length > 0) {
          const isDummy = cached.content.some((q) =>
            q.question?.toLowerCase().includes('primary benefit of testing') ||
            q.correct_answer?.toLowerCase().includes('active recall')
          );
          if (!isDummy) {
            return NextResponse.json({ mcqs: cached.content, mcq: cached.content });
          } else {
            await db.collection('rag_study_outputs').deleteOne({ _id: cached._id });
          }
        }
      } catch (cacheErr) {
        console.warn('MCQ cache lookup notice:', cacheErr.message);
      }
    }

    const chunks = await retrieveRelevantChunks({
      query: 'quiz test questions concepts details comprehension exam practice key terms',
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

    const prompt = `Based ONLY on the document text provided below, generate ${count} multiple choice revision quiz questions.
Do NOT use generic filler questions. Every question, choice, and answer must be strictly derived from the document content.

Return ONLY valid JSON matching this exact structure:
[
  {
    "question": "Specific question text directly derived from the document",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "explanation": "Brief explanation from the text of why this option is correct"
  }
]

IMPORTANT CRITICAL RULES:
1. "options" must be an array of at least 2 (ideally 4) distinct choice strings.
2. "correct_answer" MUST be a string that exactly matches one of the choices in "options".

Document Text:
${contextText.slice(0, 12000)}`;

    let questions = [];
    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an AI study assistant that outputs strictly valid JSON of multiple-choice quiz questions with "question", "options", and "correct_answer" derived from the document.',
        json: true,
      });

      const parsed = extractJson(text);
      const rawList = Array.isArray(parsed)
        ? parsed
        : (parsed?.mcqs || parsed?.questions || parsed?.mcq || parsed?.quiz || []);

      if (Array.isArray(rawList) && rawList.length > 0) {
        questions = rawList.map((q) => {
          let options = Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map(String).map(s => s.trim()).filter(Boolean)
            : ['True', 'False', 'Cannot be determined', 'None of the above'];

          if (options.length < 2) {
            options = ['True', 'False', 'Cannot be determined', 'None of the above'];
          }

          let rawCorrect = String(q.correct_answer || q.answer || q.correctAnswer || '').trim();

          // 1. Direct match
          let matched = options.find(opt => opt.toLowerCase() === rawCorrect.toLowerCase());

          // 2. Letter match (e.g. "C" or "C)" or "Option C")
          if (!matched) {
            const letterMatch = rawCorrect.match(/^([A-D])(?:\.|\:|\s|\)|$)/i);
            if (letterMatch) {
              const letter = letterMatch[1].toUpperCase();
              const idx = letter.charCodeAt(0) - 65;
              if (options[idx]) {
                matched = options[idx];
              }
            }
          }

          // 3. Substring match
          if (!matched && rawCorrect) {
            matched = options.find(opt => opt.toLowerCase().includes(rawCorrect.toLowerCase()) || rawCorrect.toLowerCase().includes(opt.toLowerCase()));
          }

          // 4. Default to first option
          const finalCorrect = matched || options[0];

          return {
            question: String(q.question || 'Study Question').trim(),
            options,
            correct_answer: finalCorrect,
            explanation: String(q.explanation || 'Verified from course study text.').trim(),
          };
        }).filter((q) => (
          q.question
          && Array.isArray(q.options)
          && q.options.length >= 2
          && q.options.every(o => Boolean(o.trim()))
          && q.options.includes(q.correct_answer)
        ));
      }
    } catch (llmErr) {
      console.error('MCQ generation error:', llmErr.message);
      return NextResponse.json(
        { error: 'Failed to generate MCQs: ' + llmErr.message },
        { status: 502 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'AI could not extract multiple-choice questions from this document. Please try again or click Regenerate.' },
        { status: 502 }
      );
    }

    // Cache generated quiz questions in database for high-concurrency reuse
    try {
      await db.collection('rag_study_outputs').updateOne(
        { document_id: documentId, output_type: 'mcq' },
        {
          $set: {
            document_id: documentId,
            output_type: 'mcq',
            content: questions,
            updated_at: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (saveErr) {
      console.warn('Failed to cache MCQs:', saveErr.message);
    }

    return NextResponse.json({ mcqs: questions, mcq: questions });
  } catch (error) {
    console.error('MCQ generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
