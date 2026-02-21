import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { signOffActionSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import SignOff from '@/models/SignOff';
import User from '@/models/User';
import { createNotification } from '@/lib/notifications';
import type { SignOffRole } from '@/types';

const SIGN_OFF_ORDER: SignOffRole[] = ['assessor', 'learner', 'iqa', 'eqa'];

// Map user roles to the sign-off roles they are allowed to perform
const ALLOWED_SIGN_OFF_ROLE: Record<string, SignOffRole> = {
  assessor: 'assessor',
  iqa: 'iqa',
  admin: 'eqa',
  student: 'learner',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await withAuth(['assessor', 'iqa', 'admin', 'student']);
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
    const { session, error } = await withAuth(['assessor', 'iqa', 'admin', 'student']);
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

    // Verify the user's role is allowed to perform this sign-off role
    const userRole = session!.user.role;
    const allowedSignOffRole = ALLOWED_SIGN_OFF_ROLE[userRole];
    if (allowedSignOffRole !== validation.data.role) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role (${userRole}) cannot sign off the "${validation.data.role}" step`,
        },
        { status: 403 }
      );
    }

    // Get all sign-offs to enforce ordering rules
    const signOffs = await SignOff.find({ assessmentId: id }).lean();
    const signOffByRole: Record<string, (typeof signOffs)[0]> = {};
    for (const so of signOffs) {
      signOffByRole[so.role] = so;
    }

    const requestedRole = validation.data.role;

    // Check if already signed off
    if (signOffByRole[requestedRole]?.status === 'signed_off') {
      return NextResponse.json(
        { success: false, error: 'This role has already been signed off' },
        { status: 400 }
      );
    }

    // Assessor & Learner can sign off independently (no prerequisites).
    // IQA requires both Assessor AND Learner signed off.
    // EQA requires IQA signed off.
    if (requestedRole === 'iqa') {
      const assessorDone = signOffByRole['assessor']?.status === 'signed_off';
      const learnerDone = signOffByRole['learner']?.status === 'signed_off';
      if (!assessorDone || !learnerDone) {
        return NextResponse.json(
          { success: false, error: 'Both Assessor and Learner must sign off before IQA' },
          { status: 400 }
        );
      }
    } else if (requestedRole === 'eqa') {
      if (signOffByRole['iqa']?.status !== 'signed_off') {
        return NextResponse.json(
          { success: false, error: 'IQA must sign off before EQA' },
          { status: 400 }
        );
      }
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

    // Send notifications based on who signed off
    if (validation.data.status === 'signed_off') {
      const signerUser = await User.findById(session!.user.id, 'name').lean();
      const signerName = signerUser?.name || 'A user';
      const assessmentTitle = assessment.title || 'an assessment';
      const learnerId = assessment.learnerId?.toString();
      const assessorId = assessment.assessorId?.toString();

      if (requestedRole === 'assessor' && learnerId) {
        createNotification({
          userId: learnerId,
          type: 'sign_off_assessor',
          title: 'Assessor Signed Off',
          message: `${signerName} signed off on assessment "${assessmentTitle}"`,
          entityType: 'Assessment',
          entityId: id,
        });
      } else if (requestedRole === 'learner' && assessorId) {
        createNotification({
          userId: assessorId,
          type: 'sign_off_learner',
          title: 'Learner Signed Off',
          message: `${signerName} signed off on assessment "${assessmentTitle}"`,
          entityType: 'Assessment',
          entityId: id,
        });
      } else if (requestedRole === 'iqa') {
        // Notify both assessor and learner
        if (assessorId) {
          createNotification({
            userId: assessorId,
            type: 'sign_off_iqa',
            title: 'IQA Signed Off',
            message: `IQA signed off on assessment "${assessmentTitle}"`,
            entityType: 'Assessment',
            entityId: id,
          });
        }
        if (learnerId) {
          createNotification({
            userId: learnerId,
            type: 'sign_off_iqa',
            title: 'IQA Signed Off',
            message: `IQA signed off on assessment "${assessmentTitle}"`,
            entityType: 'Assessment',
            entityId: id,
          });
        }
      }
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
