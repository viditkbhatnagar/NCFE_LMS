import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { criteriaMappingUpdateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
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

    const maps = await AssessmentCriteriaMap.find({ assessmentId: id }).lean();
    const criteriaIds = maps.map((m) => m.criteriaId.toString());

    return NextResponse.json({ success: true, data: criteriaIds });
  } catch (err) {
    console.error('Error fetching criteria mapping:', err);
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
    const validation = criteriaMappingUpdateSchema.safeParse(body);
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
    if (assessment.assessorId.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Diff-based update using transaction
    const existing = await AssessmentCriteriaMap.find({ assessmentId: id }).lean();
    const existingIds = new Set(existing.map((m) => m.criteriaId.toString()));
    const newIds = new Set(validation.data.criteriaIds);

    const toAdd = validation.data.criteriaIds.filter((cId) => !existingIds.has(cId));
    const toRemove = [...existingIds].filter((cId) => !newIds.has(cId));

    const dbSession = await Assessment.startSession();
    try {
      dbSession.startTransaction();

      if (toRemove.length > 0) {
        await AssessmentCriteriaMap.deleteMany(
          { assessmentId: id, criteriaId: { $in: toRemove } },
          { session: dbSession }
        );
      }
      if (toAdd.length > 0) {
        await AssessmentCriteriaMap.insertMany(
          toAdd.map((criteriaId) => ({ assessmentId: id, criteriaId })),
          { session: dbSession }
        );
      }

      await dbSession.commitTransaction();
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      dbSession.endSession();
    }

    return NextResponse.json({
      success: true,
      data: validation.data.criteriaIds,
    });
  } catch (err) {
    console.error('Error updating criteria mapping:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
