import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Message from '@/models/Message';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const userId = new mongoose.Types.ObjectId(session!.user.id);

    // Verify the current user is a participant in this thread
    const participantCheck = await Message.findOne({
      threadId,
      $or: [{ senderId: userId }, { recipientId: userId }],
    });

    if (!participantCheck) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: you are not a participant in this thread' },
        { status: 403 }
      );
    }

    // Fetch all messages in the thread, sorted by createdAt ascending
    const messages = await Message.find({ threadId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name email')
      .populate('recipientId', 'name email');

    // Mark unread messages as read for the current user
    await Message.updateMany(
      {
        threadId,
        recipientId: userId,
        readAt: null,
      },
      {
        readAt: new Date(),
      }
    );

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (err) {
    console.error('Error fetching thread messages:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
