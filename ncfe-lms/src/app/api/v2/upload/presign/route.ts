import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-guard';
import { createPresignedUploadUrl, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '@/lib/upload';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { fileName, contentType, fileSize, ownerId } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { success: false, error: 'fileName and contentType are required' },
        { status: 400 }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 2GB limit' },
        { status: 400 }
      );
    }

    // Use ownerId if provided, otherwise fall back to session user id
    const ownerKey = ownerId || session!.user.id;

    const result = await createPresignedUploadUrl(fileName, contentType, ownerKey);

    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    console.error('Error creating presigned URL:', err);
    const message = err instanceof Error && err.message.includes('not allowed')
      ? err.message
      : 'Failed to create upload URL';
    return NextResponse.json(
      { success: false, error: message, allowedExtensions: ALLOWED_EXTENSIONS },
      { status: 400 }
    );
  }
}
