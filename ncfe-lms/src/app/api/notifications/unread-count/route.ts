import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';

export async function GET() {
  try {
    const { session, error } = await withAuth();
    if (error) return error;

    await dbConnect();

    const count = await Notification.countDocuments({
      userId: session!.user.id,
      isRead: false,
    });

    return NextResponse.json({ success: true, data: { count } });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
