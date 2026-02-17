import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Assessment from '@/models/Assessment';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
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

    // Build enrollment filter for scoping
    const enrollmentFilter: Record<string, unknown> = {
      assessorId: session!.user.id,
    };
    if (qualificationId) enrollmentFilter.qualificationId = qualificationId;

    const myEnrollments = await Enrolment.find(enrollmentFilter)
      .populate('userId', 'name email')
      .lean();

    const enrollmentIds = myEnrollments.map((e) => String(e._id));
    const learnerIds = myEnrollments.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e) => String((e.userId as any)._id)
    );

    // Parallel searches
    const [matchedUsers, matchedAssessments, matchedEvidence] = await Promise.all([
      User.find({
        _id: { $in: learnerIds },
        $or: [{ name: regex }, { email: regex }],
      })
        .select('name email role')
        .limit(5)
        .lean(),

      Assessment.find({
        assessorId: session!.user.id,
        ...(qualificationId ? { qualificationId } : {}),
        title: regex,
      })
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
