import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { workHoursCreateSchema } from '@/lib/validators';
import WorkHoursLog from '@/models/WorkHoursLog';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
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

    const user = session!.user;

    // Ownership check based on role
    if (enrollmentId) {
      const enrollment = await Enrolment.findById(enrollmentId).lean();
      const isOwner =
        user.role === 'student'
          ? enrollment?.userId?.toString() === user.id
          : enrollment?.assessorId?.toString() === user.id;
      if (!enrollment || !isOwner) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else if (learnerId) {
      // Students can only query their own learnerId
      if (user.role === 'student' && learnerId !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
      const enrollmentFilter =
        user.role === 'student'
          ? { userId: learnerId }
          : { userId: learnerId, assessorId: user.id };
      const hasEnrollment = await Enrolment.exists(enrollmentFilter);
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
    const { session, error } = await withAuth(['assessor', 'student']);
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

    const user = session!.user;

    // Verify enrollment ownership based on role
    const enrollment = await Enrolment.findById(parsed.data.enrollmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    const isOwner =
      user.role === 'student'
        ? enrollment.userId?.toString() === user.id
        : enrollment.assessorId?.toString() === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Students can only log hours for themselves
    const learnerId =
      user.role === 'student' ? user.id : parsed.data.learnerId;

    const entry = await WorkHoursLog.create({
      ...parsed.data,
      learnerId,
      recordedBy: user.id,
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
