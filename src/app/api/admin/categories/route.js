import { NextResponse } from 'next/server';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { ensureQuizSeeded, INITIAL_CATEGORIES } from '@/lib/quizDb';

export async function GET() {
  try {
    await ensureQuizSeeded();
    const db = await getDatabase();
    let categories = await db.collection('quiz_categories').find({}).toArray().catch(() => []);
    if (!categories || categories.length === 0) {
      categories = INITIAL_CATEGORIES;
    }
    return NextResponse.json({ success: true, categories });
  } catch (err) {
    console.error('Error fetching admin categories:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, name, image = '📚', description = '', subcategories = [] } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const db = await getDatabase();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (id) {
      // Update
      await db.collection('quiz_categories').updateOne(
        { $or: [{ _id: safeObjectId(id) }, { id: id }] },
        {
          $set: {
            name: name.trim(),
            slug,
            image,
            description: description.trim(),
            subcategories: Array.isArray(subcategories) ? subcategories : [],
            updated_at: new Date(),
          },
        }
      );
      return NextResponse.json({ success: true });
    }

    // Insert
    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      slug,
      image,
      description: description.trim(),
      subcategories: Array.isArray(subcategories) ? subcategories : [],
      created_at: new Date(),
    };

    await db.collection('quiz_categories').insertOne(newCat);
    return NextResponse.json({ success: true, category: newCat });
  } catch (err) {
    console.error('Error saving admin category:', err);
    return NextResponse.json({ error: 'Failed to save category' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Category ID required' }, { status: 400 });
    }

    const db = await getDatabase();
    await db.collection('quiz_categories').deleteOne({
      $or: [{ _id: safeObjectId(id) }, { id: id }],
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting category:', err);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
