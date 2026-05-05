import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export async function POST(req: Request) {
  const { session, error } = await withAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const user = await User.findById(session!.user.id).select('+passwordHash');
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const ok = await user.comparePassword(parsed.data.currentPassword);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: 'Current password is incorrect' },
      { status: 400 }
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { success: false, error: 'New password must differ from the current one' },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  await User.collection.updateOne(
    { _id: user._id },
    { $set: { passwordHash: hashed, mustChangePassword: false, updatedAt: new Date() } }
  );

  await createAuditLog({
    userId: session!.user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: session!.user.id,
    newValue: { trigger: 'self_service' },
  });

  return NextResponse.json({ success: true });
}
