import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Unit from '@/models/Unit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';
import Evidence from '@/models/Evidence';
import User from '@/models/User';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ learnerId: string }> }
) {
  try {
    const { learnerId } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa']);

    if (error) {
      return error;
    }

    const user = session!.user;

    // Students can only view their own progress
    if (user.role === 'student' && user.id !== learnerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: can only view your own progress' },
        { status: 403 }
      );
    }

    await dbConnect();

    // Verify learner exists
    const learner = await User.findById(learnerId).select('name email role');

    if (!learner) {
      return NextResponse.json(
        { success: false, error: 'Learner not found' },
        { status: 404 }
      );
    }

    // For assessors, verify the learner is assigned to them
    if (user.role === 'assessor') {
      const assignedEnrolment = await Enrolment.findOne({
        userId: learnerId,
        assessorId: user.id,
      });

      if (!assignedEnrolment) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: learner not assigned to you' },
          { status: 403 }
        );
      }
    }

    // Get all enrolments for the learner
    const enrolments = await Enrolment.find({ userId: learnerId }).populate('qualificationId');

    const qualificationProgress = await Promise.all(
      enrolments.map(async (enrolment) => {
        const qualificationId = enrolment.qualificationId;
        const units = await Unit.find({ qualificationId: qualificationId._id }).sort({
          unitReference: 1,
        });

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

            return {
              unitId: unit._id,
              unitReference: unit.unitReference,
              title: unit.title,
              totalACs,
              metACs,
              evidenceCount,
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
        qualifications: qualificationProgress,
      },
    });
  } catch (err) {
    console.error('Error fetching learner progress:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
