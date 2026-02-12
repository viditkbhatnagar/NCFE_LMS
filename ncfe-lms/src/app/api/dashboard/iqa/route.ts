import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import IQASample from '@/models/IQASample';
import User from '@/models/User';

export async function GET() {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    const iqaUserId = session!.user.id;

    // Count pending samples assigned to this IQA
    const pendingSamplesCount = await IQASample.countDocuments({
      iqaUserId,
      status: 'pending',
    });

    // Count reviewed samples
    const reviewedSamplesCount = await IQASample.countDocuments({
      iqaUserId,
      status: 'reviewed',
    });

    // Count completed samples
    const completedSamplesCount = await IQASample.countDocuments({
      iqaUserId,
      status: 'completed',
    });

    // Count total assessors in the system (users with assessor role)
    const assessorsCount = await User.countDocuments({
      role: 'assessor',
      status: 'active',
    });

    // Count total samples (for overview)
    const totalSamplesCount = await IQASample.countDocuments({ iqaUserId });

    return NextResponse.json({
      success: true,
      data: {
        pendingSamplesCount,
        reviewedSamplesCount,
        completedSamplesCount,
        assessorsCount,
        totalSamplesCount,
      },
    });
  } catch (err) {
    console.error('Error fetching IQA dashboard:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
