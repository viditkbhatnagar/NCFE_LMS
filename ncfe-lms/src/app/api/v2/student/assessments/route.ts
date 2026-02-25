import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import SignOff from '@/models/SignOff';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const qualificationId = searchParams.get('qualificationId');

    if (!qualificationId) {
      return NextResponse.json(
        { success: false, error: 'qualificationId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify student has an enrollment for this qualification
    const enrollment = await Enrolment.findOne({
      userId: session!.user.id,
      qualificationId,
    }).lean();

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    // Students see published and published_modified assessments assigned to them
    const assessments = await Assessment.find({
      learnerId: session!.user.id,
      qualificationId,
      enrollmentId: enrollment._id,
      status: { $in: ['published', 'published_modified'] },
    })
      .populate('learnerId', 'name email')
      .populate('enrollmentId', 'cohortId')
      .sort({ date: -1 })
      .lean();

    // Aggregate criteria counts (same pattern as assessor route)
    const assessmentIds = assessments.map((a) => a._id);
    const criteriaCounts = await AssessmentCriteriaMap.aggregate([
      { $match: { assessmentId: { $in: assessmentIds } } },
      { $group: { _id: '$assessmentId', count: { $sum: 1 } } },
    ]);
    const criteriaCountMap: Record<string, number> = {};
    for (const c of criteriaCounts) {
      criteriaCountMap[c._id.toString()] = c.count;
    }

    // Aggregate sign-off summaries
    const signOffs = await SignOff.find({
      assessmentId: { $in: assessmentIds },
    }).lean();
    const signOffMap: Record<string, Array<{ role: string; status: string }>> = {};
    for (const so of signOffs) {
      const key = so.assessmentId.toString();
      if (!signOffMap[key]) signOffMap[key] = [];
      signOffMap[key].push({ role: so.role, status: so.status });
    }

    const data = assessments.map((a) => ({
      ...a,
      criteriaCount: criteriaCountMap[a._id.toString()] || 0,
      signOffs: signOffMap[a._id.toString()] || [],
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching student assessments:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
