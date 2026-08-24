import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import IQADecision from '@/models/IQADecision';
import IQASample from '@/models/IQASample';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['iqa', 'admin']);
    if (error) return error;

    await dbConnect();

    const decision = await IQADecision.findById(id);
    if (!decision) {
      return NextResponse.json(
        { success: false, error: 'IQA decision not found' },
        { status: 404 }
      );
    }

    // 404 rather than 403 so we never confirm another IQA's decision exists.
    if (session!.user.role !== 'admin' && decision.iqaUserId.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'IQA decision not found' },
        { status: 404 }
      );
    }

    const sampleId = decision.iqaSampleId;
    await IQADecision.findByIdAndDelete(id);

    if (sampleId) {
      const remaining = await IQADecision.countDocuments({ iqaSampleId: sampleId });
      if (remaining === 0) {
        await IQASample.findByIdAndUpdate(sampleId, { status: 'pending' });
      }
    }

    await createAuditLog({
      userId: session!.user.id,
      action: 'iqa_decision_deleted',
      entityType: 'IQADecision',
      entityId: id,
      oldValue: {
        iqaSampleId: sampleId?.toString(),
        decision: decision.decision,
      },
    });

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting IQA decision:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
