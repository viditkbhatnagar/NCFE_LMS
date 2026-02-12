import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { iqaDecisionSchema } from '@/lib/validators';
import IQADecision from '@/models/IQADecision';
import IQASample from '@/models/IQASample';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const body = await request.json();

    // Validate input
    const validation = iqaDecisionSchema.safeParse(body);

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

    const { iqaSampleId, decision, rationale, actionsForAssessor } = validation.data;

    await dbConnect();

    // Verify the IQA sample exists
    const sample = await IQASample.findById(iqaSampleId);

    if (!sample) {
      return NextResponse.json(
        { success: false, error: 'IQA sample not found' },
        { status: 404 }
      );
    }

    const iqaDecision = await IQADecision.create({
      iqaSampleId,
      decision,
      rationale,
      actionsForAssessor: actionsForAssessor || '',
      iqaUserId: session!.user.id,
      decidedAt: new Date(),
    });

    // Update the sample status to 'reviewed'
    sample.status = 'reviewed';
    await sample.save();

    await createAuditLog({
      userId: session!.user.id,
      action: 'iqa_decision_created',
      entityType: 'IQADecision',
      entityId: iqaDecision._id.toString(),
      newValue: {
        iqaSampleId,
        decision,
      },
    });

    return NextResponse.json(
      { success: true, data: iqaDecision },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating IQA decision:', err);
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

    const decision = searchParams.get('decision');
    if (decision) filter.decision = decision;

    const [decisions, total] = await Promise.all([
      IQADecision.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('iqaUserId', 'name email')
        .populate({
          path: 'iqaSampleId',
          populate: [
            { path: 'assessorId', select: 'name email' },
            { path: 'learnerId', select: 'name email' },
            { path: 'unitId', select: 'title unitReference' },
          ],
        }),
      IQADecision.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: decisions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching IQA decisions:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
