import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || '-createdAt';
    const skip = (page - 1) * limit;

    await dbConnect();

    const assessorId = session!.user.id;

    const filter = { assessorId };

    const [enrolments, total] = await Promise.all([
      Enrolment.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatar status')
        .populate('qualificationId', 'title code level'),
      Enrolment.countDocuments(filter),
    ]);

    // Deduplicate learners (a learner may have multiple enrolments)
    const learnersMap = new Map<
      string,
      { learner: Record<string, unknown>; enrolments: typeof enrolments }
    >();

    for (const enrolment of enrolments) {
      const learnerId = enrolment.userId?._id?.toString() || enrolment.userId?.toString();
      if (!learnerId) continue;

      if (!learnersMap.has(learnerId)) {
        learnersMap.set(learnerId, {
          learner: enrolment.userId as unknown as Record<string, unknown>,
          enrolments: [],
        });
      }
      learnersMap.get(learnerId)!.enrolments.push(enrolment);
    }

    const learners = Array.from(learnersMap.values());

    return NextResponse.json({
      success: true,
      data: learners,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching assessor learners:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
