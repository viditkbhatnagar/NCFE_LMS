import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Unit from '@/models/Unit';
import LearningOutcome from '@/models/LearningOutcome';
import AssessmentCriteria from '@/models/AssessmentCriteria';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await dbConnect();

    const unit = await Unit.findById(id);

    if (!unit) {
      return NextResponse.json(
        { success: false, error: 'Unit not found' },
        { status: 404 }
      );
    }

    const learningOutcomes = await LearningOutcome.find({
      unitId: unit._id,
    }).sort({ loNumber: 1 });

    // Fetch assessment criteria for each learning outcome and nest them
    const learningOutcomesWithCriteria = await Promise.all(
      learningOutcomes.map(async (lo) => {
        const assessmentCriteria = await AssessmentCriteria.find({
          learningOutcomeId: lo._id,
        }).sort({ acNumber: 1 });

        return {
          ...lo.toObject(),
          assessmentCriteria,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        unit,
        learningOutcomes: learningOutcomesWithCriteria,
      },
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
