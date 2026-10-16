import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServerVoiceCounts } from '@/lib/voiceStore';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getServerVoiceCounts('all');
    const counts = result?.counts || result || {};
    const speakers = result?.speakers || {};
    return NextResponse.json({ counts, speakers });
  } catch (error) {
    console.error('Error in GET /api/voice/active-counts:', error);
    return NextResponse.json({ counts: {}, speakers: {} });
  }
}
