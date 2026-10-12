import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const folderPrefix = formData.get('prefix') || 'studycord/uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. If Cloudinary is configured, upload directly to Cloudinary
    if (isCloudinaryConfigured()) {
      try {
        const result = await uploadToCloudinary(buffer, {
          folder: typeof folderPrefix === 'string' ? folderPrefix : 'studycord/uploads',
          filename: file.name,
          resourceType: 'auto',
        });

        return NextResponse.json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          provider: 'cloudinary',
        });
      } catch (cloudErr) {
        console.error('Cloudinary upload error, falling back to local disk:', cloudErr);
      }
    }

    // 2. Fallback: Save locally to /public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, filename);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      provider: 'local',
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
