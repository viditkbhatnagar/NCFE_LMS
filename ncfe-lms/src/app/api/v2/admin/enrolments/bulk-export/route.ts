import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { csvBody, csvResponse } from '@/lib/csv';
import Enrolment from '@/models/Enrolment';
import '@/models/User';
import '@/models/Qualification';

const MAX_IDS = 100;

interface PopulatedRef {
  _id?: unknown;
  name?: string;
  email?: string;
  title?: string;
}

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

  const enrolments = await Enrolment.find({ _id: { $in: ids } })
    .populate<{ userId: PopulatedRef }>('userId', 'name email')
    .populate<{ qualificationId: PopulatedRef }>('qualificationId', 'title')
    .populate<{ assessorId: PopulatedRef }>('assessorId', 'name')
    .populate<{ assessorIds: PopulatedRef[] }>('assessorIds', 'name')
    .lean();

  const headers = [
    'studentName',
    'studentEmail',
    'qualificationTitle',
    'assessorName',
    'cohort',
    'status',
    'enrolledAt',
  ];
  const rows = enrolments.map((e) => {
    // All assigned assessors (comma-joined), falling back to the lead.
    const names =
      Array.isArray(e.assessorIds) && e.assessorIds.length > 0
        ? e.assessorIds.map((a) => a?.name).filter(Boolean).join(', ')
        : e.assessorId?.name ?? '';
    return [
      e.userId?.name ?? '',
      e.userId?.email ?? '',
      e.qualificationId?.title ?? '',
      names,
      e.cohortId ?? '',
      e.status,
      e.enrolledAt instanceof Date ? e.enrolledAt.toISOString() : String(e.enrolledAt ?? ''),
    ];
  });

  await createAuditLog({
    userId: session!.user.id,
    action: 'ENROLMENTS_EXPORTED',
    entityType: 'Enrolment',
    entityId: session!.user.id,
    newValue: { count: enrolments.length, ids },
  });

  const filename = `enrolments-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  return csvResponse(filename, csvBody(headers, rows));
}
