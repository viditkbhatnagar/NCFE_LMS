import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Assessment from '@/models/Assessment';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const qualificationId = searchParams.get('qualificationId') || null;

    if (q.length < 2) {
      return NextResponse.json({
        success: true,
        data: { members: [], assessments: [], evidence: [] },
      });
    }

    await dbConnect();

    // Escape special regex characters in the query
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const user = session!.user;

    // Build enrollment filter based on role
    const enrollmentFilter: Record<string, unknown> = {};
    if (user.role === 'student') {
      enrollmentFilter.userId = user.id;
    } else {
      enrollmentFilter.assessorId = user.id;
    }
    if (qualificationId) enrollmentFilter.qualificationId = qualificationId;

    const myEnrollments = await Enrolment.find(enrollmentFilter)
      .populate('userId', 'name email')
      .lean();

    const enrollmentIds = myEnrollments.map((e) => String(e._id));

    // For students: find fellow learners + assessors on same qualification
    // For assessors: find learners in their enrollments
    let memberSearchIds: string[];
    if (user.role === 'student') {
      // Get qualification IDs from student's enrollments
      const qualIds = [...new Set(myEnrollments.map((e) => String(e.qualificationId)))];

      // Find all enrollments for those qualifications (to get fellow learners + assessors)
      const allEnrollments = await Enrolment.find({
        qualificationId: { $in: qualIds },
      })
        .populate('userId', 'name email')
        .populate('assessorId', 'name email')
        .lean();

      const idSet = new Set<string>();
      for (const e of allEnrollments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const learner = e.userId as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assessor = e.assessorId as any;
        if (learner?._id) idSet.add(String(learner._id));
        if (assessor?._id) idSet.add(String(assessor._id));
      }
      // Remove self from member search
      idSet.delete(user.id);
      memberSearchIds = [...idSet];
    } else {
      memberSearchIds = myEnrollments.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e) => String((e.userId as any)._id)
      );
    }

    // Build assessment filter based on role
    const assessmentFilter: Record<string, unknown> = { title: regex };
    if (user.role === 'student') {
      assessmentFilter.learnerId = user.id;
    } else {
      assessmentFilter.assessorId = user.id;
    }
    if (qualificationId) assessmentFilter.qualificationId = qualificationId;

    // Parallel searches
    const [matchedUsers, matchedAssessments, matchedEvidence] = await Promise.all([
      User.find({
        _id: { $in: memberSearchIds },
        $or: [{ name: regex }, { email: regex }],
      })
        .select('name email role')
        .limit(5)
        .lean(),

      Assessment.find(assessmentFilter)
        .populate('learnerId', 'name')
        .sort({ date: -1 })
        .limit(5)
        .lean(),

      Evidence.find({
        enrolmentId: { $in: enrollmentIds },
        $or: [{ fileName: regex }, { label: regex }],
      })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Build maps for enrichment
    const enrollmentToLearnerName = new Map<string, string>();
    const learnerIdToEnrollmentId = new Map<string, string>();
    for (const e of myEnrollments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = e.userId as any;
      enrollmentToLearnerName.set(String(e._id), u.name);
      learnerIdToEnrollmentId.set(String(u._id), String(e._id));
    }

    const members = matchedUsers.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      enrollmentId: learnerIdToEnrollmentId.get(String(u._id)),
    }));

    const assessments = matchedAssessments.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = a.learnerId as any;
      return {
        _id: String(a._id),
        title: a.title || 'Untitled',
        date: a.date ? new Date(a.date).toISOString() : '',
        assessmentKind: a.assessmentKind,
        learnerName: l?.name || '',
      };
    });

    const evidence = matchedEvidence.map((ev) => ({
      _id: String(ev._id),
      fileName: ev.fileName,
      label: ev.label,
      learnerName: enrollmentToLearnerName.get(String(ev.enrolmentId)) || '',
    }));

    return NextResponse.json({
      success: true,
      data: { members, assessments, evidence },
    });
  } catch (err) {
    console.error('Error searching:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
