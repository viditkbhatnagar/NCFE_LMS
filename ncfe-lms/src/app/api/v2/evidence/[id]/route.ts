import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { deleteFile } from '@/lib/upload';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student', 'assessor']);
    if (error) return error;

    await dbConnect();

    const evidence = await Evidence.findById(id);
    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Verify ownership via enrollment
    const enrollment = await Enrolment.findById(evidence.enrolmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    const isOwner =
      user.role === 'assessor'
        ? enrollment.assessorId?.toString() === user.id
        : enrollment.userId?.toString() === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Students can only rename draft/submitted evidence (not assessed)
    if (user.role === 'student' && evidence.status === 'assessed') {
      return NextResponse.json(
        { success: false, error: 'Cannot modify assessed evidence' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { label, description } = body;

    if (label !== undefined) {
      if (!label.trim()) {
        return NextResponse.json(
          { success: false, error: 'Label cannot be empty' },
          { status: 400 }
        );
      }
      evidence.label = label.trim();
    }
    if (description !== undefined) {
      evidence.description = description;
    }

    await evidence.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: evidence._id.toString(),
        label: evidence.label,
        description: evidence.description,
      },
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student', 'assessor']);
    if (error) return error;

    await dbConnect();

    const evidence = await Evidence.findById(id);
    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Verify ownership via enrollment
    const enrollment = await Enrolment.findById(evidence.enrolmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    const isOwner =
      user.role === 'assessor'
        ? enrollment.assessorId?.toString() === user.id
        : enrollment.userId?.toString() === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Students can only delete draft/submitted evidence (not assessed)
    if (user.role === 'student' && evidence.status === 'assessed') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete assessed evidence' },
        { status: 403 }
      );
    }

    // Delete file from storage
    try {
      await deleteFile(evidence.fileUrl, {
        storageProvider: evidence.storageProvider as 'local' | 's3' | undefined,
        storageBucket: evidence.storageBucket,
        storageKey: evidence.storageKey,
      });
    } catch (fileErr) {
      console.error('Failed to delete file from storage:', fileErr);
      // Continue with DB deletion even if file delete fails
    }

    await Evidence.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting evidence:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
