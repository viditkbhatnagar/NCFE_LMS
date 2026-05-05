import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { generatePassword } from '@/lib/password-generator';
import { sendWelcomeEmail } from '@/lib/email';
import { checkRateLimit, rateLimitIdentity } from '@/lib/rate-limit';
import User from '@/models/User';

const MAX_IDS = 100;

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  // Cap to 10 bulk-resend operations per minute per admin
  const rl = checkRateLimit(
    rateLimitIdentity(req, session?.user.id),
    { limit: 10, routeKey: 'admin/users:bulk-resend-welcome' },
    req.url,
  );
  if (!rl.ok) return rl.response;

  await dbConnect();

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: 'No ids provided' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { success: false, error: `Too many ids (max ${MAX_IDS})` },
      { status: 400 },
    );
  }

  const users = await User.find({ _id: { $in: ids } }).select('_id name email role');

  let sent = 0;
  const failed: { id: string; error: string }[] = [];

  for (const user of users) {
    try {
      const password = generatePassword();
      user.set('passwordHash', password);
      await user.save();

      const result = await sendWelcomeEmail({
        name: user.name,
        email: user.email,
        password,
        role: user.role,
        loginUrl: `${process.env.APP_BASE_URL || ''}/sign-in`,
      });

      if (result.ok) {
        sent += 1;
        await createAuditLog({
          userId: session!.user.id,
          action: 'EMAIL_SENT',
          entityType: 'User',
          entityId: String(user._id),
          newValue: { template: 'welcome', source: 'bulk_resend' },
        });
      } else {
        failed.push({ id: String(user._id), error: result.error || 'unknown' });
        await createAuditLog({
          userId: session!.user.id,
          action: 'EMAIL_FAILED',
          entityType: 'User',
          entityId: String(user._id),
          newValue: { template: 'welcome', source: 'bulk_resend', error: result.error },
        });
      }
    } catch (e) {
      failed.push({
        id: String(user._id),
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  // Audit any ids in the request that didn't resolve to a user (so caller sees the gap).
  const foundIds = new Set(users.map((u) => String(u._id)));
  for (const id of ids) {
    if (!foundIds.has(id)) {
      failed.push({ id, error: 'user not found' });
    }
  }

  return NextResponse.json({
    success: true,
    data: { sent, failed },
  });
}
