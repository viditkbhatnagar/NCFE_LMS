import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Submission from '@/models/Submission';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    const submission = await Submission.findById(id)
      .populate('unitId')
      .populate('enrolmentId')
      .populate('learnerId', 'name email')
      .populate('assessorId', 'name email');

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Verify access: students can only see their own submissions
    const user = session!.user;
    if (
      user.role === 'student' &&
      submission.learnerId?._id?.toString() !== user.id &&
      (submission.learnerId as unknown as string)?.toString() !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch evidence documents
    const evidenceDocs = await Evidence.find({
      _id: { $in: submission.evidenceIds },
    });

    // Fetch active mappings for all evidence
    const evidenceIds = evidenceDocs.map((e) => e._id);
    const mappings = await EvidenceMapping.find({
      evidenceId: { $in: evidenceIds },
      status: 'active',
    })
      .populate('assessmentCriteriaId')
      .populate('learningOutcomeId');

    // Build evidence with their mappings
    const mappingsByEvidence: Record<string, typeof mappings> = {};
    for (const mapping of mappings) {
      const key = mapping.evidenceId.toString();
      if (!mappingsByEvidence[key]) {
        mappingsByEvidence[key] = [];
      }
      mappingsByEvidence[key].push(mapping);
    }

    const evidenceWithMappings = evidenceDocs.map((e) => ({
      ...e.toObject(),
      mappings: mappingsByEvidence[e._id.toString()] || [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        submission,
        evidence: evidenceWithMappings,
      },
    });
  } catch (err) {
    console.error('Error fetching submission:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
