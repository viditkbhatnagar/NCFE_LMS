import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Module from '@/models/Module';
import Unit from '@/models/Unit';
import { moduleUpdateSchema } from '@/lib/validators';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const body = await req.json();
  const validation = moduleUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const old = await Module.findById(id).lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updated = await Module.findByIdAndUpdate(id, validation.data, { new: true });

  await createAuditLog({
    userId: session!.user.id,
    action: 'MODULE_UPDATED',
    entityType: 'Module',
    entityId: id,
    oldValue: old as unknown as Record<string, unknown>,
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const found = await Module.findById(id);
  if (!found) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // Deleting a module does NOT delete its units — it un-groups them so the
  // curriculum content is preserved. Units fall back to the "Ungrouped"
  // section in the admin UI.
  const ungrouped = await Unit.updateMany(
    { moduleId: id },
    { $unset: { moduleId: '' } },
  );

  await Module.findByIdAndDelete(id);

  await createAuditLog({
    userId: session!.user.id,
    action: 'MODULE_DELETED',
    entityType: 'Module',
    entityId: id,
    newValue: { ungroupedUnits: ungrouped.modifiedCount },
  });

  return NextResponse.json({
    success: true,
    data: { ungroupedUnits: ungrouped.modifiedCount },
  });
}
