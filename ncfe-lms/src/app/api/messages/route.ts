import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Message from '@/models/Message';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    const body = await request.json();
    const { recipientId, content, attachmentUrl, threadId } = body;

    if (!recipientId || !content) {
      return NextResponse.json(
        { success: false, error: 'recipientId and content are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Auto-generate threadId if not provided
    // Thread IDs are deterministic based on the two participants (sorted)
    const resolvedThreadId =
      threadId ||
      [session!.user.id, recipientId]
        .sort()
        .join('_');

    const message = await Message.create({
      threadId: resolvedThreadId,
      senderId: session!.user.id,
      recipientId,
      content,
      attachmentUrl: attachmentUrl || undefined,
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'message_sent',
      entityType: 'Message',
      entityId: message._id.toString(),
      newValue: {
        recipientId,
        threadId: resolvedThreadId,
      },
    });

    return NextResponse.json(
      { success: true, data: message },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error sending message:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const userId = new mongoose.Types.ObjectId(session!.user.id);

    // Get message threads for current user, grouped by threadId
    // showing the last message and unread count
    const threads = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { recipientId: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$threadId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipientId', userId] },
                    { $eq: [{ $ifNull: ['$readAt', null] }, null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.senderId',
          foreignField: '_id',
          as: 'sender',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.recipientId',
          foreignField: '_id',
          as: 'recipient',
        },
      },
      {
        $project: {
          threadId: '$_id',
          lastMessage: {
            _id: '$lastMessage._id',
            content: '$lastMessage.content',
            createdAt: '$lastMessage.createdAt',
            senderId: '$lastMessage.senderId',
            recipientId: '$lastMessage.recipientId',
          },
          sender: {
            $arrayElemAt: [
              {
                $map: {
                  input: '$sender',
                  as: 's',
                  in: { _id: '$$s._id', name: '$$s.name', email: '$$s.email' },
                },
              },
              0,
            ],
          },
          recipient: {
            $arrayElemAt: [
              {
                $map: {
                  input: '$recipient',
                  as: 'r',
                  in: { _id: '$$r._id', name: '$$r.name', email: '$$r.email' },
                },
              },
              0,
            ],
          },
          messageCount: 1,
          unreadCount: 1,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: threads,
    });
  } catch (err) {
    console.error('Error fetching message threads:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
