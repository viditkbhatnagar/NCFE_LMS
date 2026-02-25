import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Qualification from '@/models/Qualification';
import Unit from '@/models/Unit';
import { qualificationCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || '';

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
  }

  const [qualifications, total] = await Promise.all([
    Qualification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Qualification.countDocuments(filter),
  ]);

  // Get unit counts per qualification
  const qualIds = qualifications.map((q) => q._id);
  const unitCounts = await Unit.aggregate([
    { $match: { qualificationId: { $in: qualIds } } },
    { $group: { _id: '$qualificationId', count: { $sum: 1 } } },
  ]);
  const unitCountMap = Object.fromEntries(unitCounts.map((u) => [String(u._id), u.count]));

  return NextResponse.json({
    success: true,
    data: qualifications.map((q) => ({
      ...q,
      _id: String(q._id),
      unitCount: unitCountMap[String(q._id)] || 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = qualificationCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await Qualification.findOne({ code: validation.data.code });
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A qualification with this code already exists' },
      { status: 409 }
    );
  }

  const qualification = await Qualification.create(validation.data);

  await createAuditLog({
    userId: session!.user.id,
    action: 'QUALIFICATION_CREATED',
    entityType: 'Qualification',
    entityId: String(qualification._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: qualification }, { status: 201 });
}
