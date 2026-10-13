import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { snapshotId } = await params;
    const userId = session.user.id;
    const db = await getDatabase();

    const snapshotObjId = safeObjectId(snapshotId);
    await db.collection('snapshots').updateOne(
      { $or: [{ _id: snapshotObjId }, { id: snapshotId }] },
      { $addToSet: { viewers: userId } }
    );

    return NextResponse.json({ success: true, snapshotId });
  } catch (error) {
    console.error('Error marking snapshot viewed:', error);
    return NextResponse.json({ error: error.message || 'Failed to update view' }, { status: 500 });
  }
}
