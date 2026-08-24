import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Submission from '@/models/Submission';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';
import { isEnrolmentAssessor, isEnrolmentIqa } from '@/lib/enrolment-access';
import type { IEnrolment } from '@/models/Enrolment';

// `learnerId` / `assessorId` arrive populated here, so read through to `_id`
// when present before comparing against the session user id.
function idOf(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'object' && '_id' in ref && (ref as { _id?: unknown })._id) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa', 'admin']);

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

    // Verify access based on role. Admin can read any submission; everyone
    // else must be attached to it or to the enrolment behind it.
    const user = session!.user;
    const enrolment = submission.enrolmentId as unknown as IEnrolment | null;
    let hasAccess = user.role === 'admin';
    if (user.role === 'student') {
      hasAccess = idOf(submission.learnerId) === user.id;
    } else if (user.role === 'assessor') {
      // Co-assessors are recorded on the enrolment, not on the submission.
      hasAccess =
        idOf(submission.assessorId) === user.id ||
        isEnrolmentAssessor(enrolment, user.id);
    } else if (user.role === 'iqa') {
      hasAccess = isEnrolmentIqa(enrolment, user.id);
    }
    if (!hasAccess) {
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

    const evidenceWithMappings = evidenceDocs.map((e) => {
      const evidenceObj = e.toObject();
      return {
        ...evidenceObj,
        fileUrl: `/api/v2/evidence/${e._id.toString()}/download`,
        mappings: mappingsByEvidence[e._id.toString()] || [],
      };
    });

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
