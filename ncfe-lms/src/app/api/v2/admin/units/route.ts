import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Unit from '@/models/Unit';
import { unitCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');
  if (!qualificationId) {
    return NextResponse.json({ success: false, error: 'qualificationId is required' }, { status: 400 });
  }

  const units = await Unit.find({ qualificationId }).sort({ unitReference: 1 }).lean();

  return NextResponse.json({ success: true, data: units });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = unitCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const unit = await Unit.create(validation.data);

  await createAuditLog({
    userId: session!.user.id,
    action: 'UNIT_CREATED',
    entityType: 'Unit',
    entityId: String(unit._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: unit }, { status: 201 });
}
