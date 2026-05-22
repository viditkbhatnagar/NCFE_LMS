import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { getFileDownloadUrl } from '@/lib/upload';
import LiveSession from '@/models/LiveSession';

// GET /api/v2/live-sessions/[id]/recording/download
// Redirects to a (signed, for S3) URL for the uploaded recording.
// `?json=true` returns the URL as JSON instead — used by the in-app preview.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await withAuth(['assessor', 'student', 'admin']);
  if (error) return error;

  await dbConnect();
  const { id } = await params;

  const live = await LiveSession.findById(id).lean();
  if (!live || !live.recordingUrl) {
    return NextResponse.json(
      { success: false, error: 'No recording available' },
      { status: 404 },
    );
  }

  const url = await getFileDownloadUrl(live.recordingUrl, {
    storageProvider: live.recordingStorageProvider,
    storageBucket: live.recordingStorageBucket,
    storageKey: live.recordingStorageKey,
  });

  if (req.nextUrl.searchParams.get('json') === 'true') {
    return NextResponse.json({ success: true, url });
  }
  return NextResponse.redirect(url);
}
