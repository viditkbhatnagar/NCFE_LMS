import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || '-createdAt';
    const skip = (page - 1) * limit;

    await dbConnect();

    const filter: Record<string, unknown> = {
      userId: session!.user.id,
    };

    // Optional filter for read/unread
    const isRead = searchParams.get('isRead');
    if (isRead === 'true') filter.isRead = true;
    if (isRead === 'false') filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
