import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';
import Enrolment from '@/models/Enrolment';
import Unit from '@/models/Unit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrolmentId: string }> }
) {
  try {
    const { enrolmentId } = await params;
    const { session, error } = await withAuth(['student', 'assessor']);

    if (error) {
      return error;
    }

    await dbConnect();

    // Verify enrolment exists and user has access
    const enrolment = await Enrolment.findById(enrolmentId).populate('qualificationId');

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found' },
        { status: 404 }
      );
    }

    // Students can only see their own portfolio; assessors can see assigned learners
    const user = session!.user;
    if (
      user.role === 'student' &&
      enrolment.userId.toString() !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: not your enrolment' },
        { status: 403 }
      );
    }

    if (
      user.role === 'assessor' &&
      enrolment.assessorId?.toString() !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: learner not assigned to you' },
        { status: 403 }
      );
    }

    // Fetch all evidence for this enrolment
    const evidenceList = await Evidence.find({ enrolmentId }).sort({ createdAt: -1 });

    // Fetch all active mappings for the evidence
    const evidenceIds = evidenceList.map((e) => e._id);
    const mappings = await EvidenceMapping.find({
      evidenceId: { $in: evidenceIds },
      status: 'active',
    }).populate('assessmentCriteriaId')
      .populate('learningOutcomeId');

    // Build a lookup from evidenceId -> mappings
    const mappingsByEvidence: Record<string, typeof mappings> = {};
    for (const mapping of mappings) {
      const key = mapping.evidenceId.toString();
      if (!mappingsByEvidence[key]) {
        mappingsByEvidence[key] = [];
      }
      mappingsByEvidence[key].push(mapping);
    }

    // Get units for this qualification
    const units = await Unit.find({
      qualificationId: enrolment.qualificationId,
    }).sort({ unitReference: 1 });

    // Group evidence by unitId
    const portfolio = units.map((unit) => {
      const unitEvidence = evidenceList
        .filter((e) => e.unitId.toString() === unit._id.toString())
        .map((e) => ({
          ...e.toObject(),
          fileUrl: `/api/v2/evidence/${e._id.toString()}/download`,
          mappings: mappingsByEvidence[e._id.toString()] || [],
        }));

      return {
        unit: unit.toObject(),
        evidence: unitEvidence,
        evidenceCount: unitEvidence.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        enrolment,
        portfolio,
      },
    });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
