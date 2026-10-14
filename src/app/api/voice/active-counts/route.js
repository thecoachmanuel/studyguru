import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServerVoiceCounts } from '@/lib/voiceStore';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const counts = await getServerVoiceCounts('all');
    return NextResponse.json({ counts: counts || {} });
  } catch (error) {
    console.error('Error in GET /api/voice/active-counts:', error);
    return NextResponse.json({ counts: {} });
  }
}
