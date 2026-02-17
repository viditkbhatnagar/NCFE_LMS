import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { assessmentUpdateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import AssessmentEvidenceMap from '@/models/AssessmentEvidenceMap';
import SignOff from '@/models/SignOff';
import Remark from '@/models/Remark';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
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

    if (assessment.assessorId.toString() !== session!.user.id) {
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

    Object.assign(assessment, validation.data);
    await assessment.save();

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
