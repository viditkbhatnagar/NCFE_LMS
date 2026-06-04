import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { uploadFile, streamUploadToS3 } from '@/lib/upload';
import LiveSession from '@/models/LiveSession';

// Node runtime required: the streaming path uses Node's Readable to pipe the
// request body to S3 without buffering. (Route handlers default to nodejs, but
// we pin it so an accidental edge switch can't silently break streaming.)
export const runtime = 'nodejs';

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

    // Streaming path: the browser is sending the raw video as the request body
    // (used from the custom domain, where the S3 bucket CORS forbids a direct
    // presigned PUT). We pipe it straight to S3 in bounded-memory parts so a
    // multi-GB recording never gets buffered in this instance's RAM — that
    // buffering OOM-crashed the instance and produced the 502. This branch must
    // run BEFORE any formData() call, which would consume the body.
    const url = new URL(req.url);
    if (url.searchParams.get('mode') === 'stream') {
      if (!req.body) {
        return NextResponse.json(
          { success: false, error: 'No file stream provided' },
          { status: 400 },
        );
      }
      const fileName = url.searchParams.get('fileName') || 'recording';
      const fileType = url.searchParams.get('fileType') || req.headers.get('content-type') || '';

      const result = await streamUploadToS3({
        body: req.body,
        fileName,
        contentType: fileType,
        ownerId: session!.user.id,
      });

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
    }

    const formData = await req.formData();

    // Preferred path: the browser already uploaded the video straight to S3 via
    // a presigned URL and is just attaching the storageKey here. This avoids
    // buffering a multi-GB recording through the server (which OOM-crashed the
    // instance → 502). No file bytes touch this route in this path.
    const preStorageKey = formData.get('storageKey') as string | null;
    const preStorageBucket = formData.get('storageBucket') as string | null;
    const preFileName = formData.get('fileName') as string | null;

    let recordingFileName: string;

    if (preStorageKey) {
      live.recordingUrl = `s3://${preStorageBucket}/${preStorageKey}`;
      live.recordingStorageKey = preStorageKey;
      live.recordingStorageProvider = 's3';
      live.recordingStorageBucket = preStorageBucket || undefined;
      recordingFileName = preFileName || 'recording';
    } else {
      // Fallback (small files / local dev without S3): buffer through the
      // server. Kept for completeness; large files should use the presigned
      // path above.
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
      recordingFileName = result.fileName;
    }

    live.status = 'completed';
    await live.save();

    await createAuditLog({
      userId: session!.user.id,
      action: 'LIVE_SESSION_RECORDING_UPLOADED',
      entityType: 'LiveSession',
      entityId: id,
      newValue: { fileName: recordingFileName },
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
