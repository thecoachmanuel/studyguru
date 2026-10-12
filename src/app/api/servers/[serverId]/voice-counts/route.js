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
    const counts = await getServerVoiceCounts(serverId);

    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Error in GET /api/servers/[serverId]/voice-counts:', error);
    return NextResponse.json({ counts: {} });
  }
}
