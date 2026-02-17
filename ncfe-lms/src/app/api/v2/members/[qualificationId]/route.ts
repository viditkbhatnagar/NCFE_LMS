import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const { qualificationId } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    // Verify the requesting assessor has at least one enrollment for this qualification
    const hasAccess = await Enrolment.exists({
      qualificationId,
      assessorId: session!.user.id,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // All enrollments for this qualification
    const allEnrollments = await Enrolment.find({ qualificationId })
      .populate('userId', 'name email')
      .lean();

    // Gather unique assessor IDs from all enrollments
    const assessorIds = [
      ...new Set(
        allEnrollments
          .map((e) => e.assessorId?.toString())
          .filter(Boolean) as string[]
      ),
    ];

    // Fetch assessors as team members
    const teamUsers = await User.find({
      _id: { $in: assessorIds },
    })
      .select('name email role')
      .lean();

    const teamMembers = teamUsers.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    }));

    // Only this assessor's learners for the learner groups view
    const myEnrollments = allEnrollments.filter(
      (e) => e.assessorId?.toString() === session!.user.id
    );

    // Group by cohortId
    const cohortMap = new Map<string, typeof myEnrollments>();
    for (const e of myEnrollments) {
      const key = e.cohortId || '';
      if (!cohortMap.has(key)) cohortMap.set(key, []);
      cohortMap.get(key)!.push(e);
    }

    const learnerGroups = Array.from(cohortMap.entries()).map(([cohortId, enrs]) => ({
      cohortId,
      learners: enrs.map((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = e.userId as any;
        return {
          enrollmentId: String(e._id),
          learnerId: String(u._id),
          name: u.name,
          email: u.email,
          status: e.status,
        };
      }),
    }));

    return NextResponse.json({
      success: true,
      data: { teamMembers, learnerGroups },
    });
  } catch (err) {
    console.error('Error fetching members:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
