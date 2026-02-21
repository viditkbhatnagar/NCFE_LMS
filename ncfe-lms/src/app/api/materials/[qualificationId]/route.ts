import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import LearningMaterial from '@/models/LearningMaterial';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const { qualificationId } = await params;
    const { error } = await withAuth();

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);

    await dbConnect();

    const filter: Record<string, unknown> = {
      qualificationId,
    };

    // Optional filters
    const unitId = searchParams.get('unitId');
    const category = searchParams.get('category');

    if (unitId) filter.unitId = unitId;
    if (category) filter.category = category;

    const materials = await LearningMaterial.find(filter)
      .sort({ createdAt: -1 })
      .populate('unitId', 'title unitReference')
      .populate('qualificationId', 'title')
      .populate('uploadedBy', 'name email');

    const data = materials.map((material) => {
      const obj = material.toObject();
      if (obj.isFolder) return obj;
      return {
        ...obj,
        fileUrl: `/api/v2/materials/${obj._id.toString()}/download`,
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error fetching learning materials:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
