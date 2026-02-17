import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Unit from '@/models/Unit';
import LearningOutcome from '@/models/LearningOutcome';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import Enrolment from '@/models/Enrolment';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    // Verify enrollment belongs to this assessor
    const enrollment = await Enrolment.findById(enrollmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    if (enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const qualificationId = enrollment.qualificationId;

    // Parallel queries for the full hierarchy
    const [units, criteria, publishedAssessments] = await Promise.all([
      Unit.find({ qualificationId }).sort({ unitReference: 1 }).lean(),
      AssessmentCriteria.find({ qualificationId }).lean(),
      Assessment.find({ enrollmentId, status: 'published' })
        .select('_id title date assessmentKind status')
        .lean(),
    ]);

    // Fetch LOs for these units
    const unitIds = units.map((u) => u._id);
    const learningOutcomes = await LearningOutcome.find({
      unitId: { $in: unitIds },
    }).lean();

    // Get all criteria maps for published assessments
    const assessmentIds = publishedAssessments.map((a) => a._id);
    const criteriaMaps = await AssessmentCriteriaMap.find({
      assessmentId: { $in: assessmentIds },
    }).lean();

    // Build criteriaId → assessment IDs lookup
    const criteriaToAssessmentIds: Record<string, string[]> = {};
    for (const map of criteriaMaps) {
      const cId = map.criteriaId.toString();
      const aId = map.assessmentId.toString();
      if (!criteriaToAssessmentIds[cId]) criteriaToAssessmentIds[cId] = [];
      criteriaToAssessmentIds[cId].push(aId);
    }

    // Build assessment lookup by ID
    const assessmentById: Record<string, (typeof publishedAssessments)[0]> = {};
    for (const a of publishedAssessments) {
      assessmentById[a._id.toString()] = a;
    }

    // Assemble the tree
    let totalMet = 0;
    let totalCriteria = 0;

    const tree = units.map((unit) => {
      const unitLOs = learningOutcomes.filter(
        (lo) => lo.unitId.toString() === unit._id.toString()
      );

      let unitMet = 0;
      let unitTotal = 0;

      const progressLOs = unitLOs.map((lo) => {
        const loCriteria = criteria.filter(
          (ac) => ac.learningOutcomeId.toString() === lo._id.toString()
        );
        let loMet = 0;

        const progressACs = loCriteria.map((ac) => {
          const acId = ac._id.toString();
          const linkedAIds = criteriaToAssessmentIds[acId] || [];
          const isMet = linkedAIds.length > 0;
          if (isMet) loMet++;

          const linkedAssessments = linkedAIds.map((aId) => {
            const a = assessmentById[aId];
            return {
              _id: aId,
              title: a?.title || '',
              date: a?.date ? new Date(a.date).toISOString() : '',
              assessmentKind: a?.assessmentKind ?? null,
              status: (a?.status || 'published') as string,
            };
          });

          return {
            _id: acId,
            acNumber: ac.acNumber,
            description: ac.description,
            isMet,
            linkedAssessments,
          };
        });

        unitMet += loMet;
        unitTotal += loCriteria.length;

        return {
          _id: lo._id.toString(),
          loNumber: lo.loNumber,
          description: lo.description,
          assessmentCriteria: progressACs,
          metCount: loMet,
          totalCount: loCriteria.length,
        };
      });

      totalMet += unitMet;
      totalCriteria += unitTotal;

      return {
        _id: unit._id.toString(),
        unitReference: unit.unitReference,
        title: unit.title,
        learningOutcomes: progressLOs,
        metCount: unitMet,
        totalCount: unitTotal,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        units: tree,
        summary: { metCount: totalMet, totalCount: totalCriteria },
      },
    });
  } catch (err) {
    console.error('Error fetching progress:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
