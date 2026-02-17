import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { workHoursUpdateSchema } from '@/lib/validators';
import WorkHoursLog from '@/models/WorkHoursLog';
import Enrolment from '@/models/Enrolment';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const parsed = workHoursUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed' },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await WorkHoursLog.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    // Verify ownership via enrollment
    const enrollment = await Enrolment.findById(existing.enrollmentId).lean();
    if (!enrollment || enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const updated = await WorkHoursLog.findByIdAndUpdate(id, parsed.data, {
      new: true,
    })
      .populate('learnerId', 'name email')
      .populate('recordedBy', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating work hours entry:', err);
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

    const existing = await WorkHoursLog.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    // Verify ownership via enrollment
    const enrollment = await Enrolment.findById(existing.enrollmentId).lean();
    if (!enrollment || enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await WorkHoursLog.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting work hours entry:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
