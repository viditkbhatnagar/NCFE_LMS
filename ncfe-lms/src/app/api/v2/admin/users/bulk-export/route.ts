import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { csvBody, csvResponse } from '@/lib/csv';
import User from '@/models/User';
import Enrolment from '@/models/Enrolment';

const MAX_IDS = 100;

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: 'No ids provided' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { success: false, error: `Too many ids (max ${MAX_IDS})` },
      { status: 400 },
    );
  }

  const users = await User.find({ _id: { $in: ids } })
    .select('_id name email role status phone createdAt')
    .lean();

  // Enrolment counts per student
  const studentIds = users.filter((u) => u.role === 'student').map((u) => u._id);
  const counts = studentIds.length
    ? await Enrolment.aggregate([
        { $match: { userId: { $in: studentIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
    : [];
  const countByUser = new Map<string, number>(
    counts.map((row: { _id: { toString(): string }; count: number }) => [
      row._id.toString(),
      row.count,
    ]),
  );

  const headers = ['name', 'email', 'role', 'status', 'phone', 'createdAt', 'enrolmentCount'];
  const rows = users.map((u) => [
    u.name,
    u.email,
    u.role,
    u.status,
    u.phone ?? '',
    u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt ?? ''),
    u.role === 'student' ? countByUser.get(u._id.toString()) ?? 0 : '',
  ]);

  await createAuditLog({
    userId: session!.user.id,
    action: 'USERS_EXPORTED',
    entityType: 'User',
    entityId: session!.user.id,
    newValue: { count: users.length, ids },
  });

  const filename = `users-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  return csvResponse(filename, csvBody(headers, rows));
}
