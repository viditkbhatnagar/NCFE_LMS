import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Unit from '@/models/Unit';
import Qualification from '@/models/Qualification';
import Module from '@/models/Module';
import { unitCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');

  // No qualificationId → cross-course list with course + module title joined.
  if (!qualificationId) {
    const units = await Unit.find({}).sort({ qualificationId: 1, unitReference: 1 }).lean();
    const qids = Array.from(new Set(units.map((u) => String(u.qualificationId))));
    const mids = Array.from(
      new Set(units.map((u) => (u.moduleId ? String(u.moduleId) : '')).filter(Boolean)),
    );
    const [quals, modules] = await Promise.all([
      Qualification.find({ _id: { $in: qids } }).select('title code slug').lean(),
      Module.find({ _id: { $in: mids } }).select('title').lean(),
    ]);
    const qById = new Map(
      quals.map((q) => [String(q._id), { title: q.title, code: q.code, slug: q.slug }]),
    );
    const mById = new Map(modules.map((m) => [String(m._id), { title: m.title }]));
    return NextResponse.json({
      success: true,
      data: units.map((u) => ({
        ...u,
        qualification: qById.get(String(u.qualificationId)) ?? null,
        module: u.moduleId ? (mById.get(String(u.moduleId)) ?? null) : null,
      })),
    });
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
