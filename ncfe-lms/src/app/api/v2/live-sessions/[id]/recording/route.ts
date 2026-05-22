import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { uploadFile } from '@/lib/upload';
import LiveSession from '@/models/LiveSession';

// POST /api/v2/live-sessions/[id]/recording
// Uploads a recording file for a completed live class. The recording lives
// on the same LiveSession record — "uploaded in the same place where the
// live class was created", per the request.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await withAuth(['assessor', 'admin']);
    if (error) return error;

    await dbConnect();
    const { id } = await params;

    const live = await LiveSession.findById(id);
    if (!live) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    const result = await uploadFile(file, session!.user.id);

    live.recordingUrl = result.filePath;
    live.recordingStorageKey = result.storageKey;
    live.recordingStorageProvider = result.storageProvider;
    live.recordingStorageBucket = result.storageBucket;
    live.status = 'completed';
    await live.save();

    await createAuditLog({
      userId: session!.user.id,
      action: 'LIVE_SESSION_RECORDING_UPLOADED',
      entityType: 'LiveSession',
      entityId: id,
      newValue: { fileName: result.fileName },
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: String(live._id),
        recordingUrl: `/api/v2/live-sessions/${id}/recording/download`,
        status: live.status,
      },
    });
  } catch (err) {
    console.error('Error uploading live-session recording:', err);
    const isValidation =
      err instanceof Error &&
      (err.message.includes('size exceeds') || err.message.includes('not allowed'));
    return NextResponse.json(
      { success: false, error: isValidation ? (err as Error).message : 'Internal server error' },
      { status: isValidation ? 400 : 500 },
    );
  }
}
