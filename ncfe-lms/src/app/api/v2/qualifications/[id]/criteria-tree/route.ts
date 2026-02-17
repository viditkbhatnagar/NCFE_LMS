import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Unit from '@/models/Unit';
import LearningOutcome from '@/models/LearningOutcome';
import AssessmentCriteria from '@/models/AssessmentCriteria';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const units = await Unit.find({ qualificationId: id })
      .sort({ unitReference: 1 })
      .lean();
    const unitIds = units.map((u) => u._id);

    const [learningOutcomes, criteria] = await Promise.all([
      LearningOutcome.find({ unitId: { $in: unitIds } })
        .sort({ loNumber: 1 })
        .lean(),
      AssessmentCriteria.find({ qualificationId: id })
        .sort({ acNumber: 1 })
        .lean(),
    ]);

    // Build tree
    const tree = units.map((unit) => ({
      ...unit,
      learningOutcomes: learningOutcomes
        .filter((lo) => lo.unitId.toString() === unit._id.toString())
        .map((lo) => ({
          ...lo,
          assessmentCriteria: criteria.filter(
            (ac) => ac.learningOutcomeId.toString() === lo._id.toString()
          ),
        })),
    }));

    return NextResponse.json({ success: true, data: tree });
  } catch (err) {
    console.error('Error fetching criteria tree:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
