import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import WorkHoursLog from '@/models/WorkHoursLog';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';
import { isEnrolmentAssessor } from '@/lib/enrolment-access';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');
    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: 'enrollmentId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = session!.user;
    const enrollment = await Enrolment.findById(enrollmentId).lean();
    const isOwner =
      user.role === 'student'
        ? enrollment?.userId?.toString() === user.id
        : isEnrolmentAssessor(enrollment, user.id);
    if (!enrollment || !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const [aggResult, qualification] = await Promise.all([
      WorkHoursLog.aggregate([
        { $match: { enrollmentId: enrollment._id } },
        {
          $group: {
            _id: null,
            totalMinutes: {
              $sum: { $add: [{ $multiply: ['$hours', 60] }, '$minutes'] },
            },
            entryCount: { $sum: 1 },
          },
        },
      ]),
      Qualification.findById(enrollment.qualificationId)
        .select('requiredWorkHours')
        .lean(),
    ]);

    const totalMinutes = aggResult[0]?.totalMinutes ?? 0;
    const entryCount = aggResult[0]?.entryCount ?? 0;
    const requiredWorkHours = qualification?.requiredWorkHours ?? null;

    return NextResponse.json({
      success: true,
      data: {
        totalMinutes,
        entryCount,
        requiredWorkHours,
      },
    });
  } catch (err) {
    console.error('Error fetching work hours totals:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
