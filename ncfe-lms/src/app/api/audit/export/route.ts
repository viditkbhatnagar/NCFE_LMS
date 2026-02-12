import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import AuditLog from '@/models/AuditLog';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa', 'admin']);

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    await dbConnect();

    const filter: Record<string, unknown> = {};

    // Date range filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.timestamp = dateFilter;
    }

    // Entity type filter
    const entityType = searchParams.get('entityType');
    if (entityType) filter.entityType = entityType;

    // User ID filter
    const userId = searchParams.get('userId');
    if (userId) filter.userId = userId;

    // Action filter
    const action = searchParams.get('action');
    if (action) filter.action = action;

    // Limit to 1000 records max
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(1000)
      .populate('userId', 'name email role');

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        count: logs.length,
        limit: 1000,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          entityType: entityType || null,
          userId: userId || null,
          action: action || null,
        },
      },
    });
  } catch (err) {
    console.error('Error exporting audit logs:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
