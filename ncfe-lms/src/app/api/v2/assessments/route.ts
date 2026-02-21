import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { assessmentCreateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import SignOff from '@/models/SignOff';
import Enrolment from '@/models/Enrolment';
import { createNotification } from '@/lib/notifications';
import User from '@/models/User';
import type { SignOffRole } from '@/types';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const qualificationId = searchParams.get('qualificationId');
    const enrollmentId = searchParams.get('enrollmentId');
    const status = searchParams.get('status');

    if (!qualificationId) {
      return NextResponse.json(
        { success: false, error: 'qualificationId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const filter: Record<string, unknown> = {
      assessorId: session!.user.id,
      qualificationId,
    };
    if (enrollmentId) filter.enrollmentId = enrollmentId;
    if (status) filter.status = status;

    const assessments = await Assessment.find(filter)
      .populate('learnerId', 'name email')
      .populate('enrollmentId', 'cohortId')
      .sort({ date: -1 })
      .lean();

    // Get criteria counts for all assessments
    const assessmentIds = assessments.map((a) => a._id);
    const criteriaCounts = await AssessmentCriteriaMap.aggregate([
      { $match: { assessmentId: { $in: assessmentIds } } },
      { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
    ]);
    const criteriaCountMap: Record<string, number> = {};
    for (const c of criteriaCounts) {
      criteriaCountMap[c._id.toString()] = c.count;
    }

    // Get sign-off summaries
    const signOffs = await SignOff.find({
      assessmentId: { $in: assessmentIds },
    }).lean();
    const signOffMap: Record<string, Array<{ role: string; status: string }>> = {};
    for (const so of signOffs) {
      const key = so.assessmentId.toString();
      if (!signOffMap[key]) signOffMap[key] = [];
      signOffMap[key].push({ role: so.role, status: so.status });
    }

    const data = assessments.map((a) => ({
      ...a,
      criteriaCount: criteriaCountMap[a._id.toString()] || 0,
      signOffs: signOffMap[a._id.toString()] || [],
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching assessments:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const validation = assessmentCreateSchema.safeParse(body);
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

    // Verify enrollment exists and belongs to this assessor
    const enrollment = await Enrolment.findById(validation.data.enrollmentId);
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    if (enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: learner not assigned to you' },
        { status: 403 }
      );
    }

    // Create assessment and sign-off records atomically
    const dbSession = await Assessment.startSession();
    let populated;
    let signOffs;

    try {
      dbSession.startTransaction();

      const [assessment] = await Assessment.create(
        [{
          ...validation.data,
          assessorId: session!.user.id,
          qualificationId: enrollment.qualificationId,
        }],
        { session: dbSession }
      );

      const roles: SignOffRole[] = ['assessor', 'iqa', 'eqa', 'learner'];
      await SignOff.insertMany(
        roles.map((role) => ({
          assessmentId: assessment._id,
          role,
          status: 'pending',
        })),
        { session: dbSession }
      );

      await dbSession.commitTransaction();

      // Populate after commit
      populated = await Assessment.findById(assessment._id)
        .populate('learnerId', 'name email')
        .populate('enrollmentId', 'cohortId')
        .lean();

      signOffs = await SignOff.find({ assessmentId: assessment._id }).lean();

      // Notify learner about new assessment
      const learnerId = enrollment.userId?.toString();
      if (learnerId) {
        const assessor = await User.findById(session!.user.id, 'name').lean();
        const assessorName = assessor?.name || 'Your assessor';
        createNotification({
          userId: learnerId,
          type: 'assessment_created',
          title: 'New Assessment',
          message: `${assessorName} created a new assessment: ${validation.data.title}`,
          entityType: 'Assessment',
          entityId: assessment._id.toString(),
        });
      }
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      dbSession.endSession();
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...populated,
          criteriaCount: 0,
          signOffs: signOffs.map((s) => ({ role: s.role, status: s.status })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating assessment:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
