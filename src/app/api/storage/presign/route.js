import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createPresignedUploadUrl } from '@/lib/r2';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, contentType, prefix = 'uploads' } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Filename and contentType are required.' },
        { status: 400 }
      );
    }

    const fileExt = filename.split('.').pop() || 'bin';
    const uniqueId = crypto.randomUUID();
    const sanitizedName = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);
      
    const key = `${prefix}/${session.user.id}/${uniqueId}-${sanitizedName}`;

    const { uploadUrl, fileUrl } = await createPresignedUploadUrl(key, contentType, 300);

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      key,
    });
  } catch (error) {
    console.error('Presign URL generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
