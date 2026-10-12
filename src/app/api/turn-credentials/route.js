import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const domain = process.env.METERED_DOMAIN || 'studycord.metered.live';
    const secretKey = process.env.METERED_SECRET_KEY;

    if (!secretKey) {
      // Return public STUN servers if TURN secret is not configured
      return NextResponse.json([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]);
    }

    const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${secretKey}`);
    if (!res.ok) {
      throw new Error(`Metered API returned status ${res.status}`);
    }

    const iceServers = await res.json();
    return NextResponse.json(iceServers);
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    // Fallback to free Google STUN
    return NextResponse.json([
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]);
  }
}
