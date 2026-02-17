import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';

export async function GET() {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    // Aggregate: distinct qualificationIds with learner counts for this assessor
    // Must cast string to ObjectId for aggregation $match
    const enrollmentAgg = await Enrolment.aggregate([
      {
        $match: {
          assessorId: new mongoose.Types.ObjectId(session!.user.id),
        },
      },
      {
        $group: {
          _id: '$qualificationId',
          learnerCount: { $sum: 1 },
        },
      },
    ]);

    const qualificationIds = enrollmentAgg.map(
      (e: { _id: mongoose.Types.ObjectId }) => e._id
    );
    const countMap: Record<string, number> = {};
    for (const e of enrollmentAgg) {
      countMap[e._id.toString()] = e.learnerCount;
    }

    const qualifications = await Qualification.find({
      _id: { $in: qualificationIds as mongoose.Types.ObjectId[] },
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
      learnerCount: countMap[String(q._id)] || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching assessor courses:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
