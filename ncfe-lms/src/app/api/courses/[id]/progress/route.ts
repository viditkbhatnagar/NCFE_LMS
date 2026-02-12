import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Qualification from '@/models/Qualification';
import Unit from '@/models/Unit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student']);

    if (error) {
      return error;
    }

    await dbConnect();

    const learnerId = session!.user.id;

    // Verify qualification exists
    const qualification = await Qualification.findById(id);

    if (!qualification) {
      return NextResponse.json(
        { success: false, error: 'Qualification not found' },
        { status: 404 }
      );
    }

    // Get all units for this qualification
    const units = await Unit.find({ qualificationId: id }).sort({ unitReference: 1 });

    // For each unit, compute AC progress
    const unitProgress = await Promise.all(
      units.map(async (unit) => {
        const assessmentCriteria = await AssessmentCriteria.find({ unitId: unit._id });
        const totalACs = assessmentCriteria.length;

        // Count ACs with 'met' decisions for this learner
        const metDecisions = await AssessmentDecision.find({
          unitId: unit._id,
          learnerId,
          decision: 'met',
        }).distinct('assessmentCriteriaId');

        const metACs = metDecisions.length;

        // Build per-AC detail
        const acProgress = assessmentCriteria.map((ac) => ({
          assessmentCriteriaId: ac._id,
          acNumber: ac.acNumber,
          description: ac.description,
          isMet: metDecisions.some(
            (metAcId) => metAcId.toString() === ac._id.toString()
          ),
        }));

        return {
          unitId: unit._id,
          unitReference: unit.unitReference,
          title: unit.title,
          totalACs,
          metACs,
          progress: totalACs > 0 ? Math.round((metACs / totalACs) * 100) : 0,
          isComplete: totalACs > 0 && metACs >= totalACs,
          assessmentCriteria: acProgress,
        };
      })
    );

    const totalACs = unitProgress.reduce((sum, u) => sum + u.totalACs, 0);
    const totalMet = unitProgress.reduce((sum, u) => sum + u.metACs, 0);
    const completedUnits = unitProgress.filter((u) => u.isComplete).length;

    return NextResponse.json({
      success: true,
      data: {
        qualification: {
          _id: qualification._id,
          title: qualification.title,
          code: qualification.code,
          level: qualification.level,
        },
        overallProgress: totalACs > 0 ? Math.round((totalMet / totalACs) * 100) : 0,
        completedUnits,
        totalUnits: units.length,
        units: unitProgress,
      },
    });
  } catch (err) {
    console.error('Error fetching course progress:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
