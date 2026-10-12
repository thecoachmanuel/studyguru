import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import fs from 'fs/promises';
import path from 'path';

export async function PUT(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const db = await getDatabase();
    const queryId = safeObjectId(serverId);

    const server = await db.collection('servers').findOne({
      $or: [{ _id: queryId }, { id: serverId }],
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const membership = await db.collection('server_members').findOne({
      server_id: serverId,
      user_id: session.user.id,
    });

    const isOwner = server.owner_id === session.user.id;
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicUrl = '';

    // 1. If Cloudinary is configured, upload server icon to Cloudinary
    const { uploadToCloudinary, isCloudinaryConfigured } = await import('@/lib/cloudinary');
    if (isCloudinaryConfigured()) {
      try {
        const result = await uploadToCloudinary(buffer, {
          folder: `studycord/server-icons`,
          filename: `server-${serverId}`,
          resourceType: 'image',
        });
        publicUrl = result.secure_url;
      } catch (cloudErr) {
        console.error('Cloudinary server icon upload error, falling back to local disk:', cloudErr);
      }
    }

    // 2. Fallback: Save to /public/uploads
    if (!publicUrl) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = path.extname(file.name || 'icon.png') || '.png';
      const filename = `server-${serverId}-${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      await fs.writeFile(filePath, buffer);
      publicUrl = `/uploads/${filename}`;
    }

    await db.collection('servers').updateOne(
      { $or: [{ _id: queryId }, { id: serverId }] },
      { $set: { icon_url: publicUrl, icon_path: publicUrl, updated_at: new Date() } }
    );

    return NextResponse.json({ success: true, icon_url: publicUrl, icon_path: publicUrl });
  } catch (error) {
    console.error('Error uploading server icon:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload icon' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;
    const db = await getDatabase();
    const queryId = safeObjectId(serverId);

    await db.collection('servers').updateOne(
      { $or: [{ _id: queryId }, { id: serverId }] },
      { $set: { icon_url: null, icon_path: null, updated_at: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing server icon:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove icon' }, { status: 500 });
  }
}
