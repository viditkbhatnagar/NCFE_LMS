import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import {
  assessorMatch,
  enrolmentAssessorIds,
  isEnrolmentAssessor,
  iqaMatch,
} from '@/lib/enrolment-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const { qualificationId } = await params;
    const { session, error } = await withAuth(['assessor', 'iqa', 'admin']);
    if (error) return error;

    await dbConnect();

    const role = session!.user.role;
    // Access + learner scope by role: assessor/admin see all course members; an
    // IQA sees only the learners they are assigned to.
    const scopedQuery =
      role === 'iqa'
        ? { qualificationId, ...iqaMatch(session!.user.id) }
        : role === 'admin'
          ? { qualificationId }
          : { qualificationId, ...assessorMatch(session!.user.id) };
    const hasAccess = await Enrolment.exists(scopedQuery);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Enrollments in scope (all for assessor/admin; assigned-only for iqa).
    const listQuery = role === 'iqa' ? scopedQuery : { qualificationId };
    const allEnrollments = await Enrolment.find(listQuery)
      .populate('userId', 'name email')
      .lean();

    // Gather unique assessor IDs across all enrollments (lead + secondary).
    const assessorIds = [
      ...new Set(allEnrollments.flatMap((e) => enrolmentAssessorIds(e))),
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

    // An assessor sees only their own learners; every other in-scope role sees
    // the full scoped list. Keyed on 'assessor' positively so a future role
    // added to the allowlist never falls into the assessor-only path.
    // allEnrollments is already iqaMatch-scoped for an IQA, so this cannot widen it.
    const myEnrollments =
      role === 'assessor'
        ? allEnrollments.filter((e) => isEnrolmentAssessor(e, session!.user.id))
        : allEnrollments;

    // Group by cohortId
    const cohortMap = new Map<string, typeof myEnrollments>();
    for (const e of myEnrollments) {
      const key = e.cohortId || '';
      if (!cohortMap.has(key)) cohortMap.set(key, []);
      cohortMap.get(key)!.push(e);
    }

    const learnerGroups = Array.from(cohortMap.entries()).map(([cohortId, enrs]) => ({
      cohortId,
      // An admin now walks EVERY enrolment on the course, so a single enrolment
      // whose learner was deleted would otherwise turn this into a 500.
      learners: enrs
        .map((e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const u = e.userId as any;
          if (!u?._id) return null;
          return {
            enrollmentId: String(e._id),
            learnerId: String(u._id),
            name: u.name ?? 'Unknown learner',
            email: u.email ?? '',
            status: e.status,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
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
