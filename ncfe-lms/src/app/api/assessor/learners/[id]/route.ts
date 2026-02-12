import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import Unit from '@/models/Unit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';
import Evidence from '@/models/Evidence';
import Submission from '@/models/Submission';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: learnerId } = await params;
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    await dbConnect();

    const assessorId = session!.user.id;

    // Verify this learner is assigned to the assessor
    const enrolments = await Enrolment.find({
      userId: learnerId,
      assessorId,
    }).populate('qualificationId');

    if (enrolments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Learner not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Fetch learner info
    const learner = await User.findById(learnerId).select('name email avatar status phone');

    if (!learner) {
      return NextResponse.json(
        { success: false, error: 'Learner not found' },
        { status: 404 }
      );
    }

    // Build progress per enrolment
    const enrolmentDetails = await Promise.all(
      enrolments.map(async (enrolment) => {
        const qualificationId = enrolment.qualificationId._id || enrolment.qualificationId;

        const units = await Unit.find({ qualificationId }).sort({ unitReference: 1 });

        const unitProgress = await Promise.all(
          units.map(async (unit) => {
            const totalACs = await AssessmentCriteria.countDocuments({
              unitId: unit._id,
            });

            const metDecisions = await AssessmentDecision.find({
              unitId: unit._id,
              learnerId,
              decision: 'met',
            }).distinct('assessmentCriteriaId');

            const metACs = metDecisions.length;

            const evidenceCount = await Evidence.countDocuments({
              enrolmentId: enrolment._id,
              unitId: unit._id,
            });

            // Check for pending submissions
            const pendingSubmissions = await Submission.countDocuments({
              enrolmentId: enrolment._id,
              unitId: unit._id,
              status: { $in: ['submitted', 'under_review'] },
            });

            return {
              unitId: unit._id,
              unitReference: unit.unitReference,
              title: unit.title,
              totalACs,
              metACs,
              evidenceCount,
              pendingSubmissions,
              progress: totalACs > 0 ? Math.round((metACs / totalACs) * 100) : 0,
              isComplete: totalACs > 0 && metACs >= totalACs,
            };
          })
        );

        const totalACs = unitProgress.reduce((sum, u) => sum + u.totalACs, 0);
        const totalMet = unitProgress.reduce((sum, u) => sum + u.metACs, 0);
        const completedUnits = unitProgress.filter((u) => u.isComplete).length;

        return {
          enrolmentId: enrolment._id,
          qualification: enrolment.qualificationId,
          status: enrolment.status,
          enrolledAt: enrolment.enrolledAt,
          overallProgress: totalACs > 0 ? Math.round((totalMet / totalACs) * 100) : 0,
          completedUnits,
          totalUnits: units.length,
          units: unitProgress,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        learner,
        enrolments: enrolmentDetails,
      },
    });
  } catch (err) {
    console.error('Error fetching learner detail:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
