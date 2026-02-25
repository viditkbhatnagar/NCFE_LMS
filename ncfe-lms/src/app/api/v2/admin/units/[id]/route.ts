import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Unit from '@/models/Unit';
import { unitUpdateSchema } from '@/lib/validators';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const body = await req.json();
  const validation = unitUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const old = await Unit.findById(id).lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updated = await Unit.findByIdAndUpdate(id, validation.data, { new: true });

  await createAuditLog({
    userId: session!.user.id,
    action: 'UNIT_UPDATED',
    entityType: 'Unit',
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
  const unit = await Unit.findById(id);
  if (!unit) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await Unit.findByIdAndDelete(id);

  await createAuditLog({
    userId: session!.user.id,
    action: 'UNIT_DELETED',
    entityType: 'Unit',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
