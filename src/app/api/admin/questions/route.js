import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { ensureQuizSeeded, INITIAL_QUESTIONS } from '@/lib/quizDb';
import { auth } from '@/auth';

export async function GET(req) {
  try {
    await ensureQuizSeeded();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category_id');
    const search = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = await getDatabase();
    const query = {};
    if (categoryId && categoryId !== 'all') {
      query.category_id = categoryId;
    }
    if (search?.trim()) {
      query.question = { $regex: search.trim(), $options: 'i' };
    }

    let questions = await db.collection('quiz_questions').find(query).limit(limit).toArray().catch(() => []);

    if (!questions || questions.length === 0) {
      questions = INITIAL_QUESTIONS;
    }

    return NextResponse.json({
      success: true,
      questions: questions.map((q) => ({
        id: q._id ? q._id.toString() : (q.id || `q-${Math.random()}`),
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        answer_index: q.answer_index ?? 0,
        explanation: q.explanation || '',
        category_id: q.category_id || 'cat-cs-ai',
        subcategory_id: q.subcategory_id || '',
        level: q.level || 1,
      })),
    });
  } catch (err) {
    console.error('Error in admin questions GET:', err);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    const body = await req.json();
    const {
      question,
      options,
      answer,
      explanation = '',
      category_id = 'cat-cs-ai',
      subcategory_id = '',
      level = 1,
    } = body;

    if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: 'Question and at least 2 options are required' }, { status: 400 });
    }

    const answerIndex = typeof answer === 'number' ? answer : options.indexOf(answer);

    const newQuestion = {
      question: question.trim(),
      options: options.map((o) => String(o).trim()),
      answer: typeof answer === 'number' ? options[answer] : answer,
      answer_index: answerIndex >= 0 ? answerIndex : 0,
      explanation: explanation.trim(),
      category_id,
      subcategory_id,
      level: parseInt(level, 10) || 1,
      created_at: new Date(),
    };

    const db = await getDatabase();
    const result = await db.collection('quiz_questions').insertOne(newQuestion);

    return NextResponse.json({
      success: true,
      question: { ...newQuestion, id: result.insertedId?.toString() },
    });
  } catch (err) {
    console.error('Error in admin questions POST:', err);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
    }

    const db = await getDatabase();
    await db.collection('quiz_questions').deleteOne({
      $or: [{ _id: safeObjectId(id) }, { id: id }],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting question:', err);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
