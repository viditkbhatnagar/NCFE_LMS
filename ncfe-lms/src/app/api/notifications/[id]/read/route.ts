import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const notification = await Notification.findById(id);

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Must be the owner of the notification
    if (notification.userId.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: not your notification' },
        { status: 403 }
      );
    }

    notification.isRead = true;
    await notification.save();

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
