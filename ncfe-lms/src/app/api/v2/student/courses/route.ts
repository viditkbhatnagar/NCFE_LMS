import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';

export async function GET() {
  try {
    const { session, error } = await withAuth(['student']);
    if (error) return error;

    await dbConnect();

    // Find distinct qualifications this student is enrolled in
    const enrollments = await Enrolment.find({
      userId: session!.user.id,
    })
      .select('qualificationId')
      .lean();

    const qualificationIds = [
      ...new Set(enrollments.map((e: any) => String(e.qualificationId))),
    ];

    if (qualificationIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const qualifications = await Qualification.find({
      _id: { $in: qualificationIds },
      status: 'active',
    })
      .select('title slug code level')
      .lean();

    const data = qualifications.map((q) => ({
      _id: String(q._id),
      title: q.title,
      slug: q.slug,
      code: q.code,
      level: q.level,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching student courses:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
