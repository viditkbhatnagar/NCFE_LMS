import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import AuditLog from '@/models/AuditLog';

function buildFilter(searchParams: URLSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  const entityType = searchParams.get('entityType');
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (entityType) filter.entityType = entityType;
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (userId) filter.userId = userId;

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        // include the entire end day
        d.setHours(23, 59, 59, 999);
        range.$lte = d;
      }
    }
    if (Object.keys(range).length > 0) filter.timestamp = range;
  }

  return filter;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const sortDir = searchParams.get('sort') === 'asc' ? 1 : -1;
  const exportFmt = searchParams.get('export'); // 'csv' to stream the filtered set

  const filter = buildFilter(searchParams);

  if (exportFmt === 'csv') {
    // Cap at 10k rows for safety; if more, the admin should narrow filters.
    const rows = await AuditLog.find(filter)
      .sort({ timestamp: sortDir })
      .limit(10_000)
      .lean();

    const header = ['timestamp', 'action', 'entityType', 'entityId', 'userId', 'ipAddress', 'newValue', 'oldValue'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        csvEscape(r.timestamp ? new Date(r.timestamp).toISOString() : ''),
        csvEscape(r.action),
        csvEscape(r.entityType),
        csvEscape(r.entityId ? String(r.entityId) : ''),
        csvEscape(r.userId ? String(r.userId) : ''),
        csvEscape(r.ipAddress || ''),
        csvEscape(r.newValue),
        csvEscape(r.oldValue),
      ].join(','));
    }
    const body = lines.join('\n');

    await createAuditLog({
      userId: session!.user.id,
      action: 'AUDIT_EXPORTED',
      entityType: 'AuditLog',
      entityId: session!.user.id,
      newValue: { rows: rows.length, filter: Object.keys(filter) },
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: sortDir })
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
