import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { deleteFile } from '@/lib/upload';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const evidence = await Evidence.findById(id)
      .populate('enrolmentId')
      .populate('unitId');

    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    const mappings = await EvidenceMapping.find({
      evidenceId: id,
      status: 'active',
    }).populate('assessmentCriteriaId')
      .populate('learningOutcomeId')
      .populate('unitId');

    return NextResponse.json({
      success: true,
      data: {
        evidence,
        mappings,
      },
    });
  } catch (err) {
    console.error('Error fetching evidence:', err);
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
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const evidence = await Evidence.findById(id);

    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    if (evidence.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft evidence can be updated' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { label, description } = body;

    const oldValue = { label: evidence.label, description: evidence.description };

    if (label !== undefined) evidence.label = label;
    if (description !== undefined) evidence.description = description;

    await evidence.save();

    await createAuditLog({
      userId: session!.user.id,
      action: 'evidence_updated',
      entityType: 'Evidence',
      entityId: evidence._id.toString(),
      oldValue,
      newValue: { label: evidence.label, description: evidence.description },
    });

    return NextResponse.json({
      success: true,
      data: evidence,
    });
  } catch (err) {
    console.error('Error updating evidence:', err);
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
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const evidence = await Evidence.findById(id);

    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    if (evidence.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only draft evidence can be deleted' },
        { status: 400 }
      );
    }

    // Delete the physical file
    await deleteFile(evidence.fileUrl);

    // Delete associated mappings
    await EvidenceMapping.deleteMany({ evidenceId: id });

    // Delete the evidence document
    await Evidence.findByIdAndDelete(id);

    await createAuditLog({
      userId: session!.user.id,
      action: 'evidence_deleted',
      entityType: 'Evidence',
      entityId: id,
      oldValue: { label: evidence.label, fileName: evidence.fileName },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Evidence deleted successfully' },
    });
  } catch (err) {
    console.error('Error deleting evidence:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
