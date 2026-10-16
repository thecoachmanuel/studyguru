import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServerVoiceCounts } from '@/lib/voiceStore';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const result = await getServerVoiceCounts(serverId);
    const counts = result?.counts || result || {};
    const speakers = result?.speakers || {};

    return NextResponse.json({ counts, speakers });
  } catch (error) {
    console.error('Error in GET /api/servers/[serverId]/voice-counts:', error);
    return NextResponse.json({ counts: {}, speakers: {} });
  }
}
