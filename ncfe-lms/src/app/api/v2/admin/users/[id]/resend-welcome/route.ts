import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { sendWelcomeEmail } from '@/lib/email';
import { generatePassword } from '@/lib/password-generator';
import User from '@/models/User';

export async function POST(
  req: NextRequest,
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

  const newPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.collection.updateOne(
    { _id: user._id },
    { $set: { passwordHash: hashedPassword, mustChangePassword: true, updatedAt: new Date() } }
  );

  await createAuditLog({
    userId: session!.user.id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: id,
    newValue: { trigger: 'resend_welcome' },
  });

  const emailResult = await sendWelcomeEmail({
    name: user.name,
    email: user.email,
    password: newPassword,
    role: user.role,
    loginUrl: `${process.env.APP_BASE_URL || ''}/sign-in`,
  });

  await createAuditLog({
    userId: session!.user.id,
    action: emailResult.ok ? 'EMAIL_SENT' : 'EMAIL_FAILED',
    entityType: 'User',
    entityId: id,
    newValue: emailResult.ok
      ? { template: 'welcome', messageId: emailResult.messageId, trigger: 'resend' }
      : { template: 'welcome', error: emailResult.error, trigger: 'resend' },
  });

  return NextResponse.json({
    success: true,
    password: newPassword,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.error }),
  });
}
