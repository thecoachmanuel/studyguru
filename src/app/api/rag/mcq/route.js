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

    const { documentId, count = 5 } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const userId = session.user.id;
    const chunks = await retrieveRelevantChunks({
      query: 'quiz test questions concepts details comprehension exam practice',
      documentId,
      userId,
      limit: 6,
    });

    const contextText = chunks.join('\n\n---\n\n');

    const prompt = `You are an AI study assistant. Generate ${count} multiple choice revision quiz questions based on the document text provided below.
Return ONLY valid JSON matching this exact structure:
[
  {
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Brief explanation of why the correct option is right"
  }
]

Document Text:
${contextText}`;

    let questions = [];
    try {
      const { text } = await generateContentWithFallback({
        prompt,
        systemPrompt: 'You are an AI that outputs strictly valid JSON arrays of multiple-choice quiz questions without extra prose.',
        json: true,
      });

      questions = extractJson(text) || [];
    } catch (llmErr) {
      console.warn('MCQ generation fallback notice:', llmErr.message);
      questions = [
        {
          question: 'What is StudyGuru?',
          options: [
            'A student collaboration platform',
            'A text editor',
            'A video game',
            'An operating system'
          ],
          correct_index: 0,
          explanation: 'StudyGuru is an AI-powered student collaboration platform. Configure GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local for live quiz generation.',
        },
      ];
    }

    return NextResponse.json({ mcq: questions });
  } catch (error) {
    console.error('MCQ generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
