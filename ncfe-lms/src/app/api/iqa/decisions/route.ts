import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { iqaDecisionSchema } from '@/lib/validators';
import IQADecision from '@/models/IQADecision';
import IQASample from '@/models/IQASample';
import User from '@/models/User';
import Assessment from '@/models/Assessment';
import { sendIqaDecisionEmail } from '@/lib/email';

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

    // G7 — email assessor + learner about the decision (soft-fail, opt-out aware).
    void notifyIqaDecisionRecipients(
      sample.assessorId?.toString(),
      sample.learnerId?.toString(),
      sample.unitId?.toString(),
      iqaDecision._id.toString(),
      decision,
      actionsForAssessor || rationale,
      session!.user.id,
    );

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

async function notifyIqaDecisionRecipients(
  assessorId: string | undefined,
  learnerId: string | undefined,
  unitId: string | undefined,
  decisionId: string,
  decision: string,
  comment: string,
  iqaUserId: string,
): Promise<void> {
  try {
    // Find an assessment matching this learner+unit so the email can deep-link
    const assessment = unitId && learnerId
      ? await Assessment.findOne({ learnerId, unitId, status: { $in: ['published', 'published_modified'] } })
          .sort({ updatedAt: -1 })
          .lean<{ _id: { toString(): string }; title: string } | null>()
      : null;
    const assessmentTitle = assessment?.title ?? 'your assessment';
    const baseUrl = process.env.APP_BASE_URL || '';
    const assessmentUrl = assessment ? `${baseUrl}/c?focus=${assessment._id.toString()}` : `${baseUrl}/c`;

    const recipientIds = [assessorId, learnerId].filter((id): id is string => !!id);
    for (const id of recipientIds) {
      const user = await User.findById(id).lean<{ name: string; email: string; notificationPreferences?: { iqaDecision?: boolean } } | null>();
      if (!user) continue;
      if (user.notificationPreferences?.iqaDecision === false) continue;

      const result = await sendIqaDecisionEmail({
        recipientName: user.name,
        recipientEmail: user.email,
        assessmentTitle,
        decision,
        comment,
        assessmentUrl,
      });
      await createAuditLog({
        userId: iqaUserId,
        action: result.ok ? 'EMAIL_SENT' : 'EMAIL_FAILED',
        entityType: 'IQADecision',
        entityId: decisionId,
        newValue: result.ok
          ? { template: 'iqa_decision', messageId: result.messageId, recipient: id }
          : { template: 'iqa_decision', error: result.error, recipient: id },
      });
    }
  } catch (err) {
    console.warn('[notifyIqaDecisionRecipients] soft-fail:', err);
  }
}
