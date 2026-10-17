import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { ensureQuizSeeded } from '@/lib/quizDb';
import { auth } from '@/auth';

export async function GET() {
  try {
    await ensureQuizSeeded();
    const db = await getDatabase();
    const categories = await db.collection('quiz_categories').find({}).toArray().catch(() => []);

    // Get question count per category
    const questionCounts = await db.collection('quiz_questions').aggregate([
      { $group: { _id: '$category_id', count: { $sum: 1 } } }
    ]).toArray().catch(() => []);

    const countMap = {};
    questionCounts.forEach((qc) => {
      if (qc._id) countMap[qc._id] = qc.count;
    });

    const enriched = categories.map((cat) => ({
      ...cat,
      question_count: countMap[cat.id] || countMap[cat._id?.toString()] || 12,
    }));

    return NextResponse.json({ categories: enriched });
  } catch (err) {
    console.error('Error fetching quiz categories:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, image = '📚', description = '', subcategories = [] } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      slug,
      image,
      description: description.trim(),
      subcategories: Array.isArray(subcategories) ? subcategories : [],
      created_at: new Date(),
    };

    const db = await getDatabase();
    await db.collection('quiz_categories').insertOne(newCategory);

    return NextResponse.json({ success: true, category: newCategory });
  } catch (err) {
    console.error('Error creating category:', err);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
