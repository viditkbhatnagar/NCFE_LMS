import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';
import '@/models/Centre';
import { adminUserCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash')
      .populate('centreId', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = adminUserCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await User.findOne({ email: validation.data.email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A user with this email already exists' },
      { status: 409 }
    );
  }

  // User model pre-save hook hashes passwordHash field
  const user = await User.create({
    name: validation.data.name,
    email: validation.data.email.toLowerCase(),
    passwordHash: validation.data.password,
    role: validation.data.role,
    phone: validation.data.phone,
    status: validation.data.status,
  });

  await createAuditLog({
    userId: session!.user.id,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: String(user._id),
    newValue: { name: validation.data.name, email: validation.data.email, role: validation.data.role },
  });

  return NextResponse.json({
    success: true,
    data: { _id: user._id, name: user.name, email: user.email, role: user.role, status: user.status },
  }, { status: 201 });
}
