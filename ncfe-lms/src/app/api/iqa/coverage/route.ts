import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import IQASample from '@/models/IQASample';

export async function GET() {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    // Count samples grouped by assessor
    const byAssessor = await IQASample.aggregate([
      {
        $group: {
          _id: '$assessorId',
          count: { $sum: 1 },
          stages: { $addToSet: '$stage' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'assessor',
        },
      },
      {
        $unwind: '$assessor',
      },
      {
        $project: {
          assessorId: '$_id',
          assessorName: '$assessor.name',
          assessorEmail: '$assessor.email',
          count: 1,
          stages: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Count samples grouped by stage
    const byStage = await IQASample.aggregate([
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Count samples grouped by unit
    const byUnit = await IQASample.aggregate([
      {
        $group: {
          _id: '$unitId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: '_id',
          foreignField: '_id',
          as: 'unit',
        },
      },
      {
        $unwind: '$unit',
      },
      {
        $project: {
          unitId: '$_id',
          unitTitle: '$unit.title',
          unitReference: '$unit.unitReference',
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Total samples count
    const totalSamples = await IQASample.countDocuments();

    return NextResponse.json({
      success: true,
      data: {
        totalSamples,
        byAssessor,
        byStage,
        byUnit,
      },
    });
  } catch (err) {
    console.error('Error fetching IQA coverage:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
