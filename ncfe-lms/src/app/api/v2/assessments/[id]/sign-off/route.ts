import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { signOffActionSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import SignOff from '@/models/SignOff';
import type { SignOffRole } from '@/types';

const SIGN_OFF_ORDER: SignOffRole[] = ['assessor', 'iqa', 'eqa', 'learner'];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await withAuth(['assessor', 'iqa', 'student']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const signOffs = await SignOff.find({ assessmentId: id })
      .populate('signedOffBy', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: signOffs });
  } catch (err) {
    console.error('Error fetching sign-offs:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'iqa', 'student']);
    if (error) return error;

    const body = await request.json();
    const validation = signOffActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }
    // Get all sign-offs to enforce sequential order
    const signOffs = await SignOff.find({ assessmentId: id }).lean();
    const signOffByRole: Record<string, (typeof signOffs)[0]> = {};
    for (const so of signOffs) {
      signOffByRole[so.role] = so;
    }

    // Find the next role that needs signing off
    const nextRole = SIGN_OFF_ORDER.find(
      (role) => signOffByRole[role]?.status !== 'signed_off'
    );

    if (!nextRole) {
      return NextResponse.json(
        { success: false, error: 'All roles have already been signed off' },
        { status: 400 }
      );
    }

    if (validation.data.role !== nextRole) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot sign off this role yet. Next required: ${nextRole}`,
        },
        { status: 400 }
      );
    }

    const updated = await SignOff.findOneAndUpdate(
      { assessmentId: id, role: validation.data.role },
      {
        status: validation.data.status,
        signedOffBy: session!.user.id,
        signedOffAt: new Date(),
        comments: validation.data.comments || '',
      },
      { new: true }
    ).populate('signedOffBy', 'name email');

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Sign-off record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error performing sign-off:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
