import dbConnect from './db';
import Notification from '@/models/Notification';
import mongoose from 'mongoose';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Fire-and-forget notification creation.
 * Logs errors but never throws — the calling API route must not fail
 * if notification creation encounters an issue.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await dbConnect();
    await Notification.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId
        ? new mongoose.Types.ObjectId(params.entityId)
        : undefined,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
