import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import mongoose from 'mongoose';
import Assessment from '@/models/Assessment';
import Evidence from '@/models/Evidence';
import LearningMaterial from '@/models/LearningMaterial';
import Enrolment from '@/models/Enrolment';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const { qualificationId } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    // All enrollments for this assessor + qualification
    const enrollments = await Enrolment.find({
      assessorId: session!.user.id,
      qualificationId,
    })
      .populate('userId', 'name email')
      .lean();

    const enrollmentIds = enrollments.map((e) => String(e._id));

    // Run all queries in parallel
    const [recentAssessments, recentEvidence, recentMaterials, otherAssessorEnrollments] =
      await Promise.all([
        Assessment.find({ assessorId: session!.user.id, qualificationId })
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

        Enrolment.find({
          qualificationId,
          assessorId: { $exists: true, $ne: new mongoose.Types.ObjectId(session!.user.id) },
        })
          .populate('assessorId', 'name email')
          .lean(),
      ]);

    // Build unique other-assessors with learner counts
    const assessorMap = new Map<string, { name: string; email: string; count: number }>();
    for (const e of otherAssessorEnrollments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = e.assessorId as any;
      if (!a || !a._id) continue;
      const key = String(a._id);
      const existing = assessorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        assessorMap.set(key, { name: a.name, email: a.email, count: 1 });
      }
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
