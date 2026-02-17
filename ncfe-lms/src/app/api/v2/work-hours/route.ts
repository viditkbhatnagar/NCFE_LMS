import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { workHoursCreateSchema } from '@/lib/validators';
import WorkHoursLog from '@/models/WorkHoursLog';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    const learnerId = searchParams.get('learnerId');
    const date = searchParams.get('date');

    if (!enrollmentId && !learnerId) {
      return NextResponse.json(
        { success: false, error: 'enrollmentId or learnerId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Ownership check
    if (enrollmentId) {
      const enrollment = await Enrolment.findById(enrollmentId).lean();
      if (!enrollment || enrollment.assessorId?.toString() !== session!.user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else if (learnerId) {
      const hasEnrollment = await Enrolment.exists({
        userId: learnerId,
        assessorId: session!.user.id,
      });
      if (!hasEnrollment) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const query: Record<string, unknown> = {};
    if (enrollmentId) query.enrollmentId = enrollmentId;
    if (learnerId) query.learnerId = learnerId;

    if (date) {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: dayStart, $lte: dayEnd };
    }

    const entries = await WorkHoursLog.find(query)
      .populate('learnerId', 'name email')
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    console.error('Error fetching work hours:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const parsed = workHoursCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify enrollment belongs to this assessor
    const enrollment = await Enrolment.findById(parsed.data.enrollmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    if (enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const entry = await WorkHoursLog.create({
      ...parsed.data,
      recordedBy: session!.user.id,
    });

    const populated = await WorkHoursLog.findById(entry._id)
      .populate('learnerId', 'name email')
      .populate('recordedBy', 'name email')
      .lean();

    return NextResponse.json(
      { success: true, data: populated },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating work hours entry:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
