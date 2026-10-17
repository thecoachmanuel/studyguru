import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { ensureQuizSeeded, INITIAL_QUESTIONS } from '@/lib/quizDb';
import { auth } from '@/auth';

export async function GET(req) {
  try {
    await ensureQuizSeeded();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category_id');
    const subcategoryId = searchParams.get('subcategory_id');
    const level = searchParams.get('level') ? parseInt(searchParams.get('level'), 10) : null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const random = searchParams.get('random') === 'true';

    const db = await getDatabase();
    const query = {};
    if (categoryId && categoryId !== 'all') {
      query.category_id = categoryId;
    }
    if (subcategoryId && subcategoryId !== 'all') {
      query.subcategory_id = subcategoryId;
    }
    if (level) {
      query.level = level;
    }

    let questions = await db.collection('quiz_questions').find(query).limit(limit * 3).toArray().catch(() => []);

    // If database returned fewer than requested, fall back to initial questions
    if (!questions || questions.length === 0) {
      questions = INITIAL_QUESTIONS.filter((q) => {
        if (categoryId && categoryId !== 'all' && q.category_id !== categoryId) return false;
        return true;
      });
      if (questions.length === 0) {
        questions = INITIAL_QUESTIONS;
      }
    }

    // Shuffle if random requested
    if (random || !level) {
      questions = [...questions].sort(() => 0.5 - Math.random());
    }

    const sliced = questions.slice(0, limit);

    return NextResponse.json({
      success: true,
      questions: sliced.map((q, idx) => ({
        id: q._id ? q._id.toString() : (q.id || `q-${idx}`),
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        answer_index: q.answer_index !== undefined ? q.answer_index : (q.options?.indexOf(q.answer) ?? 0),
        explanation: q.explanation || '',
        category_id: q.category_id,
        subcategory_id: q.subcategory_id,
        level: q.level || 1,
      })),
    });
  } catch (err) {
    console.error('Error fetching quiz questions:', err);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      question,
      options,
      answer,
      explanation = '',
      category_id = 'cat-cs-ai',
      subcategory_id = 'sub-ai-ml',
      level = 1,
    } = body;

    if (!question?.trim() || !Array.isArray(options) || options.length < 2 || !answer) {
      return NextResponse.json({ error: 'Question text, options (at least 2), and answer are required' }, { status: 400 });
    }

    const answerIndex = typeof answer === 'number' ? answer : options.indexOf(answer);

    const newQuestion = {
      question: question.trim(),
      options: options.map((opt) => String(opt).trim()),
      answer: typeof answer === 'number' ? options[answer] : answer,
      answer_index: answerIndex >= 0 ? answerIndex : 0,
      explanation: explanation.trim(),
      category_id,
      subcategory_id,
      level: parseInt(level, 10) || 1,
      created_at: new Date(),
      created_by: session.user.id,
    };

    const db = await getDatabase();
    const res = await db.collection('quiz_questions').insertOne(newQuestion);

    return NextResponse.json({
      success: true,
      question: { ...newQuestion, id: res.insertedId?.toString() },
    });
  } catch (err) {
    console.error('Error saving quiz question:', err);
    return NextResponse.json({ error: 'Failed to save question' }, { status: 500 });
  }
}
