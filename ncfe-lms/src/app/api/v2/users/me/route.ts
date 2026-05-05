import { NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import User from '@/models/User';

const updateMeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  avatar: z.string().max(2000).optional(),
  notificationPreferences: z
    .object({
      signOff: z.boolean().optional(),
      iqaDecision: z.boolean().optional(),
      newEnrolment: z.boolean().optional(),
    })
    .optional(),
});

export async function GET() {
  const { session, error } = await withAuth();
  if (error) return error;
  await dbConnect();
  const user = await User.findById(session!.user.id)
    .select('name email role phone avatar status notificationPreferences mustChangePassword')
    .lean();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: user });
}

export async function PUT(req: Request) {
  const { session, error } = await withAuth();
  if (error) return error;

  const body = await req.json();
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.avatar !== undefined) update.avatar = parsed.data.avatar;
  if (parsed.data.notificationPreferences !== undefined) {
    update.notificationPreferences = parsed.data.notificationPreferences;
  }

  const user = await User.findByIdAndUpdate(session!.user.id, update, { new: true })
    .select('name email role phone avatar status notificationPreferences')
    .lean();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await createAuditLog({
    userId: session!.user.id,
    action: 'PROFILE_UPDATED',
    entityType: 'User',
    entityId: session!.user.id,
    newValue: { fields: Object.keys(update) },
  });

  return NextResponse.json({ success: true, data: user });
}
