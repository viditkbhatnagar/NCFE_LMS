import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Enrolment from '@/models/Enrolment';
import '@/models/User';
import '@/models/Qualification';
import { adminEnrolmentUpdateSchema } from '@/lib/validators';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const enrolment = await Enrolment.findById(id)
    .populate('userId', 'name email')
    .populate('qualificationId', 'title code')
    .populate('assessorId', 'name email')
    .lean();

  if (!enrolment) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: enrolment });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const body = await req.json();
  const validation = adminEnrolmentUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const old = await Enrolment.findById(id).lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updated = await Enrolment.findByIdAndUpdate(id, validation.data, { new: true })
    .populate('userId', 'name email')
    .populate('qualificationId', 'title code')
    .populate('assessorId', 'name email')
    .lean();

  await createAuditLog({
    userId: session!.user.id,
    action: 'ENROLMENT_UPDATED',
    entityType: 'Enrolment',
    entityId: id,
    oldValue: old as unknown as Record<string, unknown>,
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const enrolment = await Enrolment.findById(id);
  if (!enrolment) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await Enrolment.findByIdAndUpdate(id, { status: 'withdrawn' });

  await createAuditLog({
    userId: session!.user.id,
    action: 'ENROLMENT_WITHDRAWN',
    entityType: 'Enrolment',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
