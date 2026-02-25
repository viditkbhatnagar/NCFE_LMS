import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Qualification from '@/models/Qualification';
import { qualificationUpdateSchema } from '@/lib/validators';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const qualification = await Qualification.findById(id).lean();
  if (!qualification) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: qualification });
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
  const validation = qualificationUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const old = await Qualification.findById(id).lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updated = await Qualification.findByIdAndUpdate(id, validation.data, { new: true });

  await createAuditLog({
    userId: session!.user.id,
    action: 'QUALIFICATION_UPDATED',
    entityType: 'Qualification',
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
  const qualification = await Qualification.findById(id);
  if (!qualification) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await Qualification.findByIdAndUpdate(id, { status: 'inactive' });

  await createAuditLog({
    userId: session!.user.id,
    action: 'QUALIFICATION_DEACTIVATED',
    entityType: 'Qualification',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
