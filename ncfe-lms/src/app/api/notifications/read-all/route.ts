import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';

export async function PUT() {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const result = await Notification.updateMany(
      {
        userId: session!.user.id,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
