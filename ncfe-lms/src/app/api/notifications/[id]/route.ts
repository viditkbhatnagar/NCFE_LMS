import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';

// DELETE /api/notifications/[id]
// Users can delete their own notifications (the only items in the system
// that lacked a per-item delete control).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await withAuth();
  if (error) return error;

  await dbConnect();
  const { id } = await params;

  const notif = await Notification.findById(id);
  if (!notif) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  if (String(notif.userId) !== session!.user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  await Notification.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
