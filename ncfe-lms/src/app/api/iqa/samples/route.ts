import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { iqaSampleSchema } from '@/lib/validators';
import IQASample from '@/models/IQASample';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const body = await request.json();

    // Validate input
    const validation = iqaSampleSchema.safeParse(body);

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

    const { assessorId, learnerId, unitId, qualificationId, assessmentMethodsSampled, stage } =
      validation.data;

    await dbConnect();

    const sample = await IQASample.create({
      iqaUserId: session!.user.id,
      assessorId,
      learnerId,
      unitId,
      qualificationId,
      assessmentMethodsSampled,
      stage,
      status: 'pending',
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'iqa_sample_created',
      entityType: 'IQASample',
      entityId: sample._id.toString(),
      newValue: {
        assessorId,
        learnerId,
        unitId,
        qualificationId,
        stage,
      },
    });

    return NextResponse.json(
      { success: true, data: sample },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating IQA sample:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || '-createdAt';
    const skip = (page - 1) * limit;

    await dbConnect();

    const filter: Record<string, unknown> = {};

    // Optional filters
    const assessorId = searchParams.get('assessorId');
    const stage = searchParams.get('stage');
    const status = searchParams.get('status');

    if (assessorId) filter.assessorId = assessorId;
    if (stage) filter.stage = stage;
    if (status) filter.status = status;

    const [samples, total] = await Promise.all([
      IQASample.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assessorId', 'name email')
        .populate('learnerId', 'name email')
        .populate('unitId', 'title unitReference')
        .populate('qualificationId', 'title'),
      IQASample.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: samples,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching IQA samples:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
