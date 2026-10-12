import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { retrieveRelevantChunks } from '@/lib/vectorSearch';
import { generateContentWithFallback, extractJson } from '@/lib/llm';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId, count = 6 } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const chunks = await retrieveRelevantChunks({
      query: 'key concepts definitions principles formulas facts study flashcards',
      documentId,
      userId,
      limit: 6,
    });

    const contextText = chunks.join('\n\n---\n\n');

    const prompt = `You are an AI study assistant. Generate ${count} study flashcards based on the document text provided below.
Return ONLY valid JSON matching this exact structure:
[
  { "front": "Concept or Question", "back": "Clear, concise definition or answer" }
]

Document Text:
${contextText}`;

    let flashcards = [];
    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an AI that outputs strictly valid JSON arrays of flashcards without extra prose.',
        json: true,
      });

      flashcards = extractJson(text) || [];
    } catch (llmErr) {
      console.warn('Flashcard generation fallback notice:', llmErr.message);
      // Friendly fallback if no provider is configured
      flashcards = [
        { front: 'Sample Concept', back: 'Configure GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local for live AI generation.' },
        { front: 'StudyGuru Feature', back: 'AI Flashcards generated directly from your uploaded materials.' },
      ];
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
