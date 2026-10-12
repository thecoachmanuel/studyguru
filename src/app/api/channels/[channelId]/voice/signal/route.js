import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { pushSignal } from '@/lib/voiceStore';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId } = await params;
    const body = await req.json().catch(() => ({}));
    const { receiver_id, targetUserId, signal_type, signalType, signal_data, signalData, type: altType, data: altData } = body;

    const targetReceiver = receiver_id || targetUserId;
    const type = signal_type || signalType || altType;
    const data = signal_data !== undefined ? signal_data : (signalData !== undefined ? signalData : altData);

    if (!type) {
      return NextResponse.json({ error: 'Missing signal type' }, { status: 400 });
    }

    const signal = await pushSignal({
      senderId: session.user.id,
      receiverId: targetReceiver,
      channelId,
      signalType: type,
      signalData: data,
    });

    return NextResponse.json({ success: true, signal });
  } catch (error) {
    console.error('Error in POST /api/channels/[channelId]/voice/signal:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch signal' }, { status: 500 });
  }
}
