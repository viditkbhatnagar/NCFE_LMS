import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Submission from '@/models/Submission';
import AssessmentDecision from '@/models/AssessmentDecision';

export async function GET() {
  try {
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    await dbConnect();

    const assessorId = session!.user.id;

    // Count assigned learners (unique userId in enrolments where assessorId matches)
    const enrolments = await Enrolment.find({ assessorId });
    const uniqueLearnerIds = new Set(enrolments.map((e) => e.userId.toString()));
    const assignedLearnersCount = uniqueLearnerIds.size;

    // Count pending submissions (submitted or under_review)
    const pendingSubmissionsCount = await Submission.countDocuments({
      assessorId,
      status: { $in: ['submitted', 'under_review'] },
    });

    // Count decisions made this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const decisionsThisMonth = await AssessmentDecision.countDocuments({
      assessorId,
      decisionDate: { $gte: startOfMonth },
    });

    // Count total submissions assessed
    const totalAssessedCount = await Submission.countDocuments({
      assessorId,
      status: 'assessed',
    });

    return NextResponse.json({
      success: true,
      data: {
        assignedLearnersCount,
        pendingSubmissionsCount,
        decisionsThisMonth,
        totalAssessedCount,
        activeEnrolmentsCount: enrolments.filter(
          (e) => e.status === 'enrolled' || e.status === 'in_progress'
        ).length,
      },
    });
  } catch (err) {
    console.error('Error fetching assessor dashboard:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
