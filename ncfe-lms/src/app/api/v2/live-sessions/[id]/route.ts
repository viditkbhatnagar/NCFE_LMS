import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { deleteFile } from '@/lib/upload';
import LiveSession from '@/models/LiveSession';
import { liveSessionUpdateSchema } from '@/lib/validators';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await withAuth(['assessor', 'student', 'admin']);
  if (error) return error;

  await dbConnect();
  const { id } = await params;
  const found = await LiveSession.findById(id).lean();
  if (!found) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: found });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await withAuth(['assessor', 'admin']);
  if (error) return error;

  await dbConnect();
  const { id } = await params;

  const body = await req.json();
  const validation = liveSessionUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const old = await LiveSession.findById(id);
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const update: Record<string, unknown> = { ...validation.data };
  if (validation.data.scheduledAt) {
    update.scheduledAt = new Date(validation.data.scheduledAt);
  }

  const updated = await LiveSession.findByIdAndUpdate(id, update, { new: true });

  await createAuditLog({
    userId: session!.user.id,
    action: 'LIVE_SESSION_UPDATED',
    entityType: 'LiveSession',
    entityId: id,
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await withAuth(['assessor', 'admin']);
  if (error) return error;

  await dbConnect();
  const { id } = await params;

  const found = await LiveSession.findById(id);
  if (!found) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // Clean up the recording file if one was uploaded (soft-fail).
  if (found.recordingStorageKey) {
    try {
      await deleteFile(found.recordingUrl || '', {
        storageProvider: found.recordingStorageProvider,
        storageBucket: found.recordingStorageBucket,
        storageKey: found.recordingStorageKey,
      });
    } catch (err) {
      console.warn('live-session recording delete failed:', err);
    }
  }

  await LiveSession.findByIdAndDelete(id);

  await createAuditLog({
    userId: session!.user.id,
    action: 'LIVE_SESSION_DELETED',
    entityType: 'LiveSession',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
