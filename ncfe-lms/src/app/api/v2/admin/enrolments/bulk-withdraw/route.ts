import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
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

  const result = await Enrolment.updateMany(
    { _id: { $in: ids }, status: { $ne: 'withdrawn' } },
    { $set: { status: 'withdrawn' } },
  );

  await Promise.all(
    ids.map((id) =>
      createAuditLog({
        userId: session!.user.id,
        action: 'ENROLMENT_WITHDRAWN_BULK',
        entityType: 'Enrolment',
        entityId: id,
        newValue: { status: 'withdrawn' },
      }),
    ),
  );

  return NextResponse.json({
    success: true,
    data: { updated: result.modifiedCount },
  });
}
