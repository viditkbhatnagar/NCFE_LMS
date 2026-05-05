import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';
import { adminPasswordResetSchema } from '@/lib/validators';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const body = await req.json();
  const validation = adminPasswordResetSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(validation.data.newPassword, 12);
  await User.collection.updateOne(
    { _id: user._id },
    { $set: { passwordHash: hashedPassword, updatedAt: new Date() } }
  );

  await createAuditLog({
    userId: session!.user.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: id,
  });

  const emailResult = await sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    password: validation.data.newPassword,
    loginUrl: `${process.env.APP_BASE_URL || ''}/sign-in`,
  });

  await createAuditLog({
    userId: session!.user.id,
    action: emailResult.ok ? 'EMAIL_SENT' : 'EMAIL_FAILED',
    entityType: 'User',
    entityId: id,
    newValue: emailResult.ok
      ? { template: 'password_reset', messageId: emailResult.messageId }
      : { template: 'password_reset', error: emailResult.error },
  });

  return NextResponse.json({
    success: true,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.error }),
  });
}
