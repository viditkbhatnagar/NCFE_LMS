import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import AuditLog from '@/models/AuditLog';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const entityType = searchParams.get('entityType');
  const action = searchParams.get('action');

  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = { $regex: action, $options: 'i' };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: logs.map((log) => ({
      _id: String(log._id),
      userId: log.userId ? String(log.userId) : null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ? String(log.entityId) : null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
