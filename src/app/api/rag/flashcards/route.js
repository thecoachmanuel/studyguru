import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateContentWithFallback, extractJson } from '@/lib/llm';

function parseTextFlashcards(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const cards = [];
  const lines = rawText.split('\n');
  let currentQ = '';
  let currentA = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const qMatch = trimmed.match(/^(?:(?:\d+[\.\)]|\*|-)?\s*(?:Q(?:uestion)?|Front|Concept|Term|Topic)\s*[:\-–]\s*)(.+)/i);
    const aMatch = trimmed.match(/^(?:(?:\*|-)?\s*(?:A(?:nswer)?|Back|Definition|Explanation|Meaning)\s*[:\-–]\s*)(.+)/i);

    if (qMatch) {
      if (currentQ && currentA) {
        cards.push({ question: currentQ.trim(), answer: currentA.trim(), front: currentQ.trim(), back: currentA.trim() });
        currentA = '';
      }
      currentQ = qMatch[1];
    } else if (aMatch) {
      currentA = aMatch[1];
    } else if (currentA) {
      currentA += ' ' + trimmed;
    }
  }

  if (currentQ && currentA) {
    cards.push({ question: currentQ.trim(), answer: currentA.trim(), front: currentQ.trim(), back: currentA.trim() });
  }

  return cards;
}

function synthesizeFlashcardsFromText(text, count = 6) {
  if (!text || typeof text !== 'string') return [];
  const paragraphs = text
    .split(/\n\n+|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 35 && p.length <= 400);

  const cards = [];
  for (const p of paragraphs.slice(0, count)) {
    const sentences = p.split(/(?<=[.?!])\s+/);
    if (sentences.length >= 1) {
      const first = sentences[0];
      const rest = sentences.slice(1).join(' ') || first;
      cards.push({
        question: `Key Concept: ${first.replace(/^[#*\s-]+/, '').slice(0, 90)}`,
        answer: rest.length > 15 ? rest : p,
        front: `Key Concept: ${first.replace(/^[#*\s-]+/, '').slice(0, 90)}`,
        back: rest.length > 15 ? rest : p,
      });
    }
  }
  return cards;
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const documentId = body.documentId || body.doc_id || body.document_id;
    const count = Math.min(Math.max(parseInt(body.count, 10) || 8, 3), 20);

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
            await db.collection('rag_study_outputs').deleteOne({ _id: cached._id });
          }
        }
      } catch (cacheErr) {
        console.warn('Flashcard cache lookup notice:', cacheErr.message);
      }
    }

    // 1. Resolve document text
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
      query: 'key concepts definitions principles formulas facts study flashcards vocabulary important terms',
      documentId: doc?._id?.toString() || documentId,
      userId,
      limit: 8,
    });

    let contextText = '';
    const clientText = String(body.documentText || body.docText || body.text || '').trim();
    const isDocPlaceholder = !doc?.extracted_text || doc.extracted_text.length < 60 || doc.extracted_text.startsWith('Academic study material:');

    if (!isDocPlaceholder && doc?.extracted_text) {
      contextText = doc.extracted_text;
    } else if (clientText && clientText.length > 20) {
      contextText = clientText;
      if (doc?._id) {
        db.collection('rag_documents').updateOne(
          { _id: doc._id },
          { $set: { extracted_text: clientText, updated_at: new Date() } }
        ).catch(() => {});
      }
    } else if (doc?.extracted_text) {
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

    const prompt = `Based ONLY on the study document text provided below, generate ${count} comprehensive educational flashcards covering the key concepts, terms, definitions, and facts in the text.
Do NOT use generic filler text or placeholder questions. Every single card must be directly based on the document text.
Punctuation rule: Never use em-dashes ('—') or double hyphens ('--') in any question or answer; write naturally using commas, periods, or colons instead.

Return ONLY a valid JSON object matching this exact structure:
{
  "flashcards": [
    {
      "question": "Specific question or key concept from the text",
      "answer": "Accurate, concise explanation or definition from the text"
    }
  ]
}

Document Text:
${contextText.slice(0, 12000)}`;

    let flashcards = [];
    let rawResponseText = '';

    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an academic study assistant that outputs strictly valid JSON with a "flashcards" array containing "question" and "answer" properties derived directly from the user document.',
        json: true,
      });

      rawResponseText = text || '';
      const parsed = extractJson(rawResponseText);
      let rawCards = [];

      if (Array.isArray(parsed)) {
        rawCards = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawCards = parsed.flashcards || parsed.cards || parsed.items || parsed.deck || parsed.data || Object.values(parsed);
      }

      if (Array.isArray(rawCards) && rawCards.length > 0) {
        flashcards = rawCards.map((card) => {
          if (!card || typeof card !== 'object') return null;
          const q = card.question || card.front || card.concept || card.title || card.term || card.prompt;
          const a = card.answer || card.back || card.definition || card.description || card.explanation || card.response;
          if (!q || !a) return null;
          return {
            question: String(q).trim(),
            answer: String(a).trim(),
            front: String(q).trim(),
            back: String(a).trim(),
          };
        }).filter(Boolean);
      }
    } catch (llmErr) {
      console.warn('Flashcard primary LLM error:', llmErr.message);
    }

    // Fallback 1: Text Q&A Regex parser
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      flashcards = parseTextFlashcards(rawResponseText);
    }

    // Fallback 2: Text synthesis from document sentences
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      flashcards = synthesizeFlashcardsFromText(contextText, count);
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { error: 'AI could not extract flashcards from this document. Please try again or click Regenerate.' },
        { status: 502 }
      );
    }

    // Cache generated flashcards in database for instant reuse
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
