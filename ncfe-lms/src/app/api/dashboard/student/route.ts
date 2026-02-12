import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Evidence from '@/models/Evidence';
import Unit from '@/models/Unit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';

export async function GET() {
  try {
    const { session, error } = await withAuth(['student']);

    if (error) {
      return error;
    }

    await dbConnect();

    const userId = session!.user.id;

    // Count enrolments
    const enrolments = await Enrolment.find({ userId });
    const enrolmentsCount = enrolments.length;

    // Count all evidence across enrolments
    const enrolmentIds = enrolments.map((e) => e._id);
    const evidenceCount = await Evidence.countDocuments({
      enrolmentId: { $in: enrolmentIds },
    });

    // Calculate completed units and total units
    let completedUnits = 0;
    let totalUnits = 0;

    for (const enrolment of enrolments) {
      const units = await Unit.find({ qualificationId: enrolment.qualificationId });
      totalUnits += units.length;

      for (const unit of units) {
        // Count total ACs for this unit
        const totalACs = await AssessmentCriteria.countDocuments({ unitId: unit._id });

        if (totalACs === 0) continue;

        // Count ACs with 'met' decisions for this learner and unit
        const metDecisions = await AssessmentDecision.countDocuments({
          unitId: unit._id,
          learnerId: userId,
          decision: 'met',
        });

        // A unit is complete when all its ACs are met
        if (metDecisions >= totalACs) {
          completedUnits++;
        }
      }
    }

    const overallProgress =
      totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        enrolmentsCount,
        evidenceCount,
        completedUnits,
        totalUnits,
        overallProgress,
      },
    });
  } catch (err) {
    console.error('Error fetching student dashboard:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
