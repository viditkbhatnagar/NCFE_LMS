import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { evidenceMappingUpdateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentEvidenceMap from '@/models/AssessmentEvidenceMap';
import Enrolment from '@/models/Enrolment';
import { isEnrolmentAssessor } from '@/lib/enrolment-access';

// Who may view/manage the evidence mapped to an assessment:
//  - admin: always
//  - the learner the assessment is for (their own evidence)
//  - the lead assessor OR any co-assessor on the learner's enrolment
// Criteria mapping + sign-off remain assessor-only elsewhere; this is just the
// evidence attachment, which learners are allowed to manage for their own work.
async function canManageAssessmentEvidence(
  assessment: { assessorId?: unknown; learnerId?: unknown; enrollmentId?: unknown },
  session: { user: { id: string; role?: string } },
): Promise<boolean> {
  const uid = session.user.id;
  const role = session.user.role;
  if (role === 'admin') return true;
  if (role === 'student') return String(assessment.learnerId ?? '') === uid;
  if (role === 'assessor') {
    if (String(assessment.assessorId ?? '') === uid) return true;
    const enrol = await Enrolment.findById(assessment.enrollmentId)
      .select('assessorId assessorIds')
      .lean();
    return enrol ? isEnrolmentAssessor(enrol, uid) : false;
  }
  return false;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student', 'admin']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }
    if (!(await canManageAssessmentEvidence(assessment, session!))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const maps = await AssessmentEvidenceMap.find({ assessmentId: id })
      .populate('evidenceId')
      .lean();

    return NextResponse.json({ success: true, data: maps });
  } catch (err) {
    console.error('Error fetching evidence mapping:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student', 'admin']);
    if (error) return error;

    const body = await request.json();
    const validation = evidenceMappingUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }
    if (!(await canManageAssessmentEvidence(assessment, session!))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Diff-based update
    const existing = await AssessmentEvidenceMap.find({ assessmentId: id }).lean();
    const existingIds = new Set(existing.map((m) => m.evidenceId.toString()));
    const newIds = new Set(validation.data.evidenceIds);

    const toAdd = validation.data.evidenceIds.filter((eId) => !existingIds.has(eId));
    const toRemove = [...existingIds].filter((eId) => !newIds.has(eId));

    await Promise.all([
      toAdd.length > 0
        ? AssessmentEvidenceMap.insertMany(
            toAdd.map((evidenceId) => ({ assessmentId: id, evidenceId }))
          )
        : Promise.resolve(),
      toRemove.length > 0
        ? AssessmentEvidenceMap.deleteMany({
            assessmentId: id,
            evidenceId: { $in: toRemove },
          })
        : Promise.resolve(),
    ]);

    // Return updated list
    const updatedMaps = await AssessmentEvidenceMap.find({ assessmentId: id })
      .populate('evidenceId')
      .lean();

    return NextResponse.json({ success: true, data: updatedMaps });
  } catch (err) {
    console.error('Error updating evidence mapping:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
