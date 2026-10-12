import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateContentWithFallback, extractJson } from '@/lib/llm';

function synthesizeQuizFromText(text, count = 5) {
  if (!text || typeof text !== 'string') return [];
  const paragraphs = text
    .split(/\n\n+|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40 && p.length <= 400);

  const questions = [];
  for (const p of paragraphs.slice(0, count)) {
    const sentences = p.split(/(?<=[.?!])\s+/);
    if (sentences.length >= 1) {
      const statement = sentences[0].replace(/^[#*\s-]+/, '').trim();
      questions.push({
        question: `Based on the study material, which statement accurately reflects: "${statement.slice(0, 85)}..."?`,
        options: [
          `Correct: ${statement.slice(0, 100)}`,
          `It contradicts the core premise of ${statement.slice(0, 40)}`,
          'It is unrelated to the document topics',
          'It applies exclusively in hypothetical conditions',
        ],
        correct_answer: `Correct: ${statement.slice(0, 100)}`,
        explanation: p.slice(0, 150),
      });
    }
  }
  return questions;
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const documentId = body.documentId || body.doc_id || body.document_id;
    const count = Math.min(Math.max(parseInt(body.count, 10) || 5, 2), 20);

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
            q.question?.toLowerCase().includes('active recall') ||
            q.question?.toLowerCase().includes('sample question')
          );
          if (!isDummy) {
            return NextResponse.json({ mcq: cached.content, mcqs: cached.content });
          } else {
            await db.collection('rag_study_outputs').deleteOne({ _id: cached._id });
          }
        }
      } catch (cacheErr) {
        console.warn('MCQ cache lookup notice:', cacheErr.message);
      }
    }

    // Resolve document text
    const safeId = safeObjectId(documentId);
    let doc = await db.collection('rag_documents').findOne({
      $or: [{ _id: safeId }, { id: documentId }, { document_id: documentId }],
    });

    if (!doc) {
      const sess = await db.collection('rag_sessions').findOne({
        $or: [{ _id: safeId }, { id: documentId }, { session_id: documentId }],
      });
      if (sess?.document_id) {
        doc = await db.collection('rag_documents').findOne({
          $or: [{ _id: safeObjectId(sess.document_id) }, { id: sess.document_id }],
        });
      }
    }

    const chunks = await retrieveRelevantChunks({
      query: 'quiz test questions concepts details comprehension exam practice key terms',
      documentId: doc?._id?.toString() || documentId,
      userId,
      limit: 8,
    });

    let contextText = '';
    if (doc?.extracted_text) {
      contextText = doc.extracted_text;
    } else if (chunks.length > 0) {
      contextText = chunks.join('\n\n---\n\n');
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
{
  "questions": [
    {
      "question": "Specific question text directly derived from the document",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation from the text of why this option is correct"
    }
  ]
}

IMPORTANT CRITICAL RULES:
1. "options" must be an array of at least 2 (ideally 4) distinct choice strings.
2. "correct_answer" MUST be a string that exactly matches one of the choices in "options".
3. Never use em-dashes ('—') or double hyphens ('--') in questions, options, or explanations; write naturally with standard commas, colons, or periods.

Document Text:
${contextText.slice(0, 12000)}`;

    let questions = [];
    let rawResponseText = '';

    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an AI study assistant that outputs strictly valid JSON with a "questions" array of multiple-choice quiz questions containing "question", "options", and "correct_answer" derived from the document.',
        json: true,
      });

      rawResponseText = text || '';
      const parsed = extractJson(rawResponseText);
      let rawList = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawList = parsed.questions || parsed.mcqs || parsed.mcq || parsed.quiz || parsed.items || parsed.data || Object.values(parsed);
      }

      if (Array.isArray(rawList) && rawList.length > 0) {
        questions = rawList.map((q) => {
          if (!q || typeof q !== 'object') return null;
          let options = Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map(String).map((s) => s.trim()).filter(Boolean)
            : ['True', 'False', 'Cannot be determined', 'None of the above'];

          if (options.length < 2) {
            options = ['True', 'False', 'Cannot be determined', 'None of the above'];
          }

          let rawCorrect = String(q.correct_answer || q.answer || q.correctAnswer || '').trim();

          // 1. Direct match
          let matched = options.find((opt) => opt.toLowerCase() === rawCorrect.toLowerCase());

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
            matched = options.find((opt) => opt.toLowerCase().includes(rawCorrect.toLowerCase()) || rawCorrect.toLowerCase().includes(opt.toLowerCase()));
          }

          // 4. Default to first option
          const finalCorrect = matched || options[0];

          return {
            question: String(q.question || 'Study Question').trim(),
            options,
            correct_answer: finalCorrect,
            explanation: String(q.explanation || 'Refer to study document for detailed rationale.').trim(),
          };
        }).filter(Boolean);
      }
    } catch (llmErr) {
      console.warn('MCQ primary LLM notice:', llmErr.message);
    }

    // Fallback: Synthesize quiz questions directly from document sentences
    if (!Array.isArray(questions) || questions.length === 0) {
      questions = synthesizeQuizFromText(contextText, count);
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'AI could not formulate quiz questions from this document. Please try again or click Regenerate.' },
        { status: 502 }
      );
    }

    // Cache generated MCQs in database for instant reuse
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

    return NextResponse.json({ mcq: questions, mcqs: questions });
  } catch (error) {
    console.error('MCQ error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate MCQs' },
      { status: 500 }
    );
  }
}
