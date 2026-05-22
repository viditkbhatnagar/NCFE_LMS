import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Module from '@/models/Module';
import { moduleCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');
  if (!qualificationId) {
    return NextResponse.json(
      { success: false, error: 'qualificationId is required' },
      { status: 400 },
    );
  }

  const modules = await Module.find({ qualificationId })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return NextResponse.json({ success: true, data: modules });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = moduleCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const created = await Module.create(validation.data);

  await createAuditLog({
    userId: session!.user.id,
    action: 'MODULE_CREATED',
    entityType: 'Module',
    entityId: String(created._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
