import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Centre from '@/models/Centre';
import { registerSchema } from '@/lib/validators';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingUser = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Assign to the default centre
    const defaultCentre = await Centre.findOne({ status: 'active' });

    const user = await User.create({
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash: parsed.data.password,
      role: parsed.data.role,
      centreId: defaultCentre?._id,
      status: 'active',
    });

    await createAuditLog({
      userId: user._id.toString(),
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user._id.toString(),
      newValue: { email: user.email, name: user.name, role: user.role },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
