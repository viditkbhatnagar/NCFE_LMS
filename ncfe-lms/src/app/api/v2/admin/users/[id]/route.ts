import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';
import '@/models/Centre';
import { adminUserUpdateSchema } from '@/lib/validators';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const user = await User.findById(id).select('-passwordHash').populate('centreId', 'name code').lean();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user });
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
  const validation = adminUserUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const old = await User.findById(id).select('-passwordHash').lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  // Check for email uniqueness if email is being updated
  if (validation.data.email) {
    const emailExists = await User.findOne({
      email: validation.data.email.toLowerCase(),
      _id: { $ne: id },
    });
    if (emailExists) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      );
    }
    validation.data.email = validation.data.email.toLowerCase();
  }

  const updated = await User.findByIdAndUpdate(id, validation.data, { new: true })
    .select('-passwordHash')
    .lean();

  await createAuditLog({
    userId: session!.user.id,
    action: 'USER_UPDATED',
    entityType: 'User',
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
  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await User.findByIdAndUpdate(id, { status: 'inactive' });

  await createAuditLog({
    userId: session!.user.id,
    action: 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
