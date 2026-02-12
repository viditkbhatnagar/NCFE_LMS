import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Submission from '@/models/Submission';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || '-createdAt';
    const skip = (page - 1) * limit;

    await dbConnect();

    const user = session!.user;
    let filter: Record<string, unknown> = {};

    if (user.role === 'student') {
      filter = { learnerId: user.id };
    } else if (user.role === 'assessor') {
      filter = { assessorId: user.id };
    }
    // iqa and admin can see all submissions

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('unitId')
        .populate('learnerId', 'name email')
        .populate('assessorId', 'name email')
        .populate('enrolmentId'),
      Submission.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['student']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { enrolmentId, unitId, evidenceIds } = body;

    if (!enrolmentId || !unitId || !evidenceIds || !Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'enrolmentId, unitId, and evidenceIds are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify enrolment belongs to student
    const enrolment = await Enrolment.findOne({
      _id: enrolmentId,
      userId: session!.user.id,
    });

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found or not yours' },
        { status: 404 }
      );
    }

    // Verify all evidence belongs to this enrolment and unit
    const evidenceDocs = await Evidence.find({
      _id: { $in: evidenceIds },
      enrolmentId,
      unitId,
    });

    if (evidenceDocs.length !== evidenceIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more evidence items not found or do not belong to this enrolment/unit' },
        { status: 400 }
      );
    }

    // Validate all evidence has at least one AC mapping
    for (const ev of evidenceDocs) {
      const mappingCount = await EvidenceMapping.countDocuments({
        evidenceId: ev._id,
        status: 'active',
      });

      if (mappingCount === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Evidence "${ev.label}" (${ev._id}) has no AC mappings. All evidence must be mapped before submission.`,
          },
          { status: 400 }
        );
      }
    }

    // Calculate attempt number (count previous submissions for same enrolment + unit)
    const previousCount = await Submission.countDocuments({ enrolmentId, unitId });
    const attemptNumber = previousCount + 1;

    // Update evidence status to 'submitted'
    await Evidence.updateMany(
      { _id: { $in: evidenceIds } },
      { status: 'submitted' }
    );

    // Create submission
    const submission = await Submission.create({
      enrolmentId,
      unitId,
      evidenceIds,
      learnerId: session!.user.id,
      assessorId: enrolment.assessorId,
      attemptNumber,
      status: 'submitted',
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'submission_created',
      entityType: 'Submission',
      entityId: submission._id.toString(),
      newValue: { unitId, evidenceCount: evidenceIds.length, attemptNumber },
    });

    return NextResponse.json(
      { success: true, data: submission },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating submission:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
