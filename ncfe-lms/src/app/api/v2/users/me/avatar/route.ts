import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { uploadFile } from '@/lib/upload';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(req: Request) {
  const { session, error } = await withAuth();
  if (error) return error;

  await dbConnect();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Bad form data' }, { status: 400 });
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Avatar exceeds 2 MB' },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: 'Avatar must be PNG, JPEG, WEBP, or GIF' },
      { status: 400 }
    );
  }

  try {
    const result = await uploadFile(file, session!.user.id);
    const ref = result.storageKey || result.filePath;
    const url = `/api/v2/users/me/avatar/render?key=${encodeURIComponent(ref)}`;
    await User.findByIdAndUpdate(session!.user.id, { avatar: ref });
    await createAuditLog({
      userId: session!.user.id,
      action: 'AVATAR_UPDATED',
      entityType: 'User',
      entityId: session!.user.id,
    });
    return NextResponse.json({
      success: true,
      data: { storageKey: result.storageKey, url, filePath: result.filePath },
    });
  } catch (err) {
    const isValidation =
      err instanceof Error &&
      (err.message.includes('size exceeds') || err.message.includes('not allowed'));
    return NextResponse.json(
      { success: false, error: isValidation ? (err as Error).message : 'Upload failed' },
      { status: isValidation ? 400 : 500 }
    );
  }
}
