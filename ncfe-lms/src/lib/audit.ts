import dbConnect from './db';
import AuditLog from '@/models/AuditLog';
import mongoose from 'mongoose';

interface CreateAuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await dbConnect();
    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(params.userId),
      action: params.action,
      entityType: params.entityType,
      entityId: new mongoose.Types.ObjectId(params.entityId),
      oldValue: params.oldValue,
      newValue: params.newValue,
      ipAddress: params.ipAddress,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
