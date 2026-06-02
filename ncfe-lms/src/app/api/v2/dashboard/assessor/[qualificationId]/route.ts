import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import mongoose from 'mongoose';
import Assessment from '@/models/Assessment';
import Evidence from '@/models/Evidence';
import LearningMaterial from '@/models/LearningMaterial';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import { assessorMatch, enrolmentAssessorIds } from '@/lib/enrolment-access';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const { qualificationId } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const url = new URL(request.url);
    const filterEnrollmentId = url.searchParams.get('enrollmentId');

    // All enrollments where this user is an assessor (lead or co-assessor).
    const enrollments = await Enrolment.find({
      qualificationId,
      ...assessorMatch(session!.user.id),
    })
      .populate('userId', 'name email')
      .lean();

    // If filtering by a specific enrollment, scope queries to that enrollment only
    const scopedEnrollments = filterEnrollmentId
      ? enrollments.filter((e) => String(e._id) === filterEnrollmentId)
      : enrollments;
    const enrollmentIds = scopedEnrollments.map((e) => String(e._id));
    const scopedLearnerIds = scopedEnrollments.map((e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = e.userId as any;
      return u?._id;
    }).filter(Boolean);

    // Build assessment query — scoped to the enrolments this user assesses
    // (lead or co-assessor), so co-assessors see all assessments on shared
    // learners, not just ones they personally created.
    const assessmentQuery: Record<string, unknown> = {
      qualificationId,
      enrollmentId: { $in: enrollmentIds },
    };
    if (filterEnrollmentId && scopedLearnerIds.length > 0) {
      assessmentQuery.learnerId = { $in: scopedLearnerIds };
    }

    // Run all queries in parallel
    const [recentAssessments, recentEvidence, recentMaterials, otherAssessorEnrollments] =
      await Promise.all([
        Assessment.find(assessmentQuery)
          .populate('learnerId', 'name')
          .sort({ date: -1 })
          .limit(5)
          .lean(),

        Evidence.find({ enrolmentId: { $in: enrollmentIds } })
          .sort({ uploadedAt: -1 })
          .limit(5)
          .lean(),

        LearningMaterial.find({ qualificationId, isFolder: false })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),

        // Every enrolment on the course — we derive the "other assessors"
        // panel from the full assessor set of each (lead + co-assessors).
        Enrolment.find({ qualificationId }).select('assessorId assessorIds').lean(),
      ]);

    // Build unique OTHER assessors (everyone but me) with learner counts.
    const me = String(session!.user.id);
    const countByAssessor = new Map<string, number>();
    for (const e of otherAssessorEnrollments) {
      for (const aid of enrolmentAssessorIds(e)) {
        if (aid === me) continue;
        countByAssessor.set(aid, (countByAssessor.get(aid) ?? 0) + 1);
      }
    }
    const otherAssessorUsers = countByAssessor.size
      ? await User.find({ _id: { $in: [...countByAssessor.keys()] } })
          .select('name email')
          .lean()
      : [];
    const assessorMap = new Map<string, { name: string; email: string; count: number }>();
    for (const u of otherAssessorUsers) {
      assessorMap.set(String(u._id), {
        name: u.name,
        email: u.email,
        count: countByAssessor.get(String(u._id)) ?? 0,
      });
    }

    // Build enrollment ID → learner name map for evidence
    const enrollmentLearnerMap = new Map<string, string>();
    for (const e of enrollments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = e.userId as any;
      enrollmentLearnerMap.set(String(e._id), u.name);
    }

    // Serialize response
    const assessors = Array.from(assessorMap.entries()).map(([id, v]) => ({
      _id: id,
      name: v.name,
      email: v.email,
      learnerCount: v.count,
    }));

    const learners = enrollments.map((e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = e.userId as any;
      return {
        _id: String(u._id),
        name: u.name,
        email: u.email,
        enrollmentId: String(e._id),
        status: e.status,
        cohortId: e.cohortId || '',
      };
    });

    const assessmentsOut = recentAssessments.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = a.learnerId as any;
      return {
        _id: String(a._id),
        title: a.title || 'Untitled',
        date: a.date ? new Date(a.date).toISOString() : '',
        assessmentKind: a.assessmentKind,
        status: a.status,
        learnerName: l?.name || '',
      };
    });

    const evidenceOut = recentEvidence.map((ev) => ({
      _id: String(ev._id),
      fileName: ev.fileName,
      label: ev.label,
      status: ev.status,
      uploadedAt: ev.uploadedAt ? new Date(ev.uploadedAt).toISOString() : '',
      learnerName: enrollmentLearnerMap.get(String(ev.enrolmentId)) || '',
      thumbnailUrl: ev.thumbnailUrl,
    }));

    const materialsOut = recentMaterials.map((m) => ({
      _id: String(m._id),
      title: m.title,
      category: m.category || '',
      fileType: m.fileType || '',
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        assessors,
        learners,
        recentAssessments: assessmentsOut,
        recentEvidence: evidenceOut,
        recentMaterials: materialsOut,
      },
    });
  } catch (err) {
    console.error('Error fetching assessor dashboard:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
