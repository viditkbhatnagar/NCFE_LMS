import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { assessmentUpdateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import AssessmentEvidenceMap from '@/models/AssessmentEvidenceMap';
import SignOff from '@/models/SignOff';
import Remark from '@/models/Remark';
import { createNotification } from '@/lib/notifications';
import '@/models/AssessmentCriteria'; // register schema for populate
import '@/models/Unit'; // register schema for nested populate
import '@/models/LearningOutcome'; // register schema for nested populate

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id)
      .populate('learnerId', 'name email')
      .populate('enrollmentId', 'cohortId')
      .lean();

    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const userId = session!.user.id;
    const userRole = session!.user.role;

    if (userRole === 'student') {
      // learnerId may be a populated object or a raw ObjectId/string
      const rawLearner = assessment.learnerId;
      if (!rawLearner) {
        return NextResponse.json(
          { success: false, error: 'Assessment not found' },
          { status: 404 }
        );
      }
      const learnerId =
        typeof rawLearner === 'string'
          ? rawLearner
          : (rawLearner as { _id?: { toString(): string } })._id?.toString() ??
            rawLearner.toString();
      if (learnerId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
      if (assessment.status !== 'published' && assessment.status !== 'published_modified') {
        return NextResponse.json(
          { success: false, error: 'Assessment not found' },
          { status: 404 }
        );
      }
    } else if (assessment.assessorId.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch related data in parallel
    const [criteriaMap, evidenceMap, signOffs, remarks] = await Promise.all([
      AssessmentCriteriaMap.find({ assessmentId: id })
        .populate({
          path: 'criteriaId',
          populate: [
            { path: 'unitId', select: 'unitReference title' },
            { path: 'learningOutcomeId', select: 'loNumber description' },
          ],
        })
        .lean(),
      AssessmentEvidenceMap.find({ assessmentId: id })
        .populate('evidenceId')
        .lean(),
      SignOff.find({ assessmentId: id })
        .populate('signedOffBy', 'name email')
        .lean(),
      Remark.find({ assessmentId: id })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        assessment,
        criteriaMap,
        evidenceMap,
        signOffs,
        remarks,
      },
    });
  } catch (err) {
    console.error('Error fetching assessment detail:', err);
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
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const validation = assessmentUpdateSchema.safeParse(body);
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

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    if (assessment.assessorId.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const previousStatus = assessment.status;
    const isStatusChangeOnly = Object.keys(validation.data).length === 1 && 'status' in validation.data;

    // Auto-transition: editing a published assessment marks it as modified
    if (
      (previousStatus === 'published' || previousStatus === 'published_modified') &&
      !isStatusChangeOnly
    ) {
      validation.data.status = 'published_modified';
    }

    Object.assign(assessment, validation.data);

    // Handle publish transitions
    if (assessment.status === 'published' && previousStatus !== 'published') {
      assessment.publishCount = (assessment.publishCount || 0) + 1;
    }

    await assessment.save();

    // Notify learner when assessment is first published
    if (previousStatus === 'draft' && assessment.status === 'published') {
      const learnerId = assessment.learnerId?.toString();
      if (learnerId) {
        createNotification({
          userId: learnerId,
          type: 'assessment_published',
          title: 'Assessment Published',
          message: `Assessment "${assessment.title}" is now available for review`,
          entityType: 'Assessment',
          entityId: assessment._id.toString(),
        });
      }
    }

    // Notify learner when a published assessment is re-published after edits
    if (previousStatus === 'published_modified' && assessment.status === 'published') {
      const learnerId = assessment.learnerId?.toString();
      if (learnerId) {
        createNotification({
          userId: learnerId,
          type: 'assessment_updated',
          title: 'Assessment Updated',
          message: `Assessment "${assessment.title}" has been updated — please review the changes`,
          entityType: 'Assessment',
          entityId: assessment._id.toString(),
        });
      }
    }

    return NextResponse.json({ success: true, data: assessment });
  } catch (err) {
    console.error('Error updating assessment:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    if (assessment.assessorId.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (assessment.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft assessments can be deleted' },
        { status: 400 }
      );
    }

    // Cascade delete: delete assessment first, then related records
    await Assessment.findByIdAndDelete(id);
    await Promise.all([
      AssessmentCriteriaMap.deleteMany({ assessmentId: id }),
      AssessmentEvidenceMap.deleteMany({ assessmentId: id }),
      SignOff.deleteMany({ assessmentId: id }),
      Remark.deleteMany({ assessmentId: id }),
    ]);

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('Error deleting assessment:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
