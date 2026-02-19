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
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const { session, error } = await withAuth(['student']);
    if (error) return error;

    await dbConnect();

    // Verify enrollment belongs to this student
    const enrollment = await Enrolment.findById(enrollmentId)
      .populate('userId', 'name email')
      .populate('assessorId', 'name email')
      .lean();

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    if (enrollment.userId?._id?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const qualificationId = enrollment.qualificationId;

    // Run all queries in parallel
    const [recentAssessments, recentEvidence, recentMaterials, allEnrollments] =
      await Promise.all([
        Assessment.find({ learnerId: session!.user.id, qualificationId })
          .populate('learnerId', 'name')
          .sort({ date: -1 })
          .limit(5)
          .lean(),

        Evidence.find({ enrolmentId: enrollmentId })
          .sort({ uploadedAt: -1 })
          .limit(5)
          .lean(),

        LearningMaterial.find({ qualificationId, isFolder: false })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),

        // All enrollments for this qualification (to find fellow learners + assessors)
        Enrolment.find({ qualificationId })
          .populate('userId', 'name email')
          .populate('assessorId', 'name email')
          .lean(),
      ]);

    // Build assessors with learner counts
    const assessorMap = new Map<string, { name: string; email: string; count: number }>();
    for (const e of allEnrollments) {
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

    const assessors = Array.from(assessorMap.entries()).map(([id, v]) => ({
      _id: id,
      name: v.name,
      email: v.email,
      learnerCount: v.count,
    }));

    // Fellow learners (exclude self)
    const learners = allEnrollments
      .filter((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = e.userId as any;
        return u && String(u._id) !== session!.user.id;
      })
      .map((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = e.userId as any;
        return {
          _id: String(u._id),
          name: u.name,
          enrollmentId: String(e._id),
          status: e.status,
          cohortId: e.cohortId || '',
        };
      });

    // Student's own name for evidence learnerName
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentName = (enrollment.userId as any)?.name || '';

    // Serialize response
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
      learnerName: studentName,
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
    console.error('Error fetching student dashboard:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
