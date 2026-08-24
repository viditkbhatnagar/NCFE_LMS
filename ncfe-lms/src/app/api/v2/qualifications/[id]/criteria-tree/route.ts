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
    // IQA included: this returns only the qualification's Unit/LO/AC reference
    // tree — no learner records — so it needs no per-user scoping. Without it,
    // "View Full Curriculum" and the portfolio page 403 for an IQA and render a
    // confident but false "0 assessment criteria across 0 units".
    const { error } = await withAuth(['assessor', 'student', 'iqa', 'admin']);
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
