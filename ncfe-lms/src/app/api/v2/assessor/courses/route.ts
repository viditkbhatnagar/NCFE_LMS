import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';

export async function GET() {
  try {
    const { session, error } = await withAuth(['assessor', 'admin']);
    if (error) return error;

    await dbConnect();

    // Admin sees every active course (they manage content across all of them).
    if (session!.user.role === 'admin') {
      const all = await Qualification.find({ status: 'active' })
        .select('title slug code level')
        .sort({ title: 1 })
        .lean();
      const counts = await Enrolment.aggregate([
        { $group: { _id: '$qualificationId', learnerCount: { $sum: 1 } } },
      ]);
      const cmap: Record<string, number> = {};
      for (const c of counts) cmap[String(c._id)] = c.learnerCount;
      return NextResponse.json({
        success: true,
        data: all.map((q) => ({
          _id: String(q._id),
          title: q.title,
          slug: q.slug,
          code: q.code,
          level: q.level,
          learnerCount: cmap[String(q._id)] || 0,
        })),
      });
    }

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

    // A course is visible to an assessor if EITHER:
    //  (a) they have an Enrolment as the assessor on it, OR
    //  (b) they are listed in Qualification.assessorIds (direct assignment).
    // (b) is what makes an admin-created course show up before any students
    // are enrolled — the long-standing "course not visible" complaint.
    const qualifications = await Qualification.find({
      status: 'active',
      $or: [
        { _id: { $in: qualificationIds as mongoose.Types.ObjectId[] } },
        { assessorIds: new mongoose.Types.ObjectId(session!.user.id) },
      ],
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
