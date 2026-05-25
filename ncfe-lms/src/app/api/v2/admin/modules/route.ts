import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Module from '@/models/Module';
import Qualification from '@/models/Qualification';
import { moduleCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');

  // No qualificationId → cross-course list (every module, course title joined).
  if (!qualificationId) {
    const modules = await Module.find({}).sort({ qualificationId: 1, order: 1 }).lean();
    const qids = Array.from(new Set(modules.map((m) => String(m.qualificationId))));
    const quals = await Qualification.find({ _id: { $in: qids } })
      .select('title code slug')
      .lean();
    const byId = new Map(
      quals.map((q) => [String(q._id), { title: q.title, code: q.code, slug: q.slug }]),
    );
    return NextResponse.json({
      success: true,
      data: modules.map((m) => ({
        ...m,
        qualification: byId.get(String(m.qualificationId)) ?? null,
      })),
    });
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
