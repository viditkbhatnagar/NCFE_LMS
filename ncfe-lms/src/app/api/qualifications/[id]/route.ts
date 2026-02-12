import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Qualification from '@/models/Qualification';
import Unit from '@/models/Unit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await dbConnect();

    const qualification = await Qualification.findById(id);

    if (!qualification) {
      return NextResponse.json(
        { success: false, error: 'Qualification not found' },
        { status: 404 }
      );
    }

    const units = await Unit.find({ qualificationId: qualification._id }).sort({
      unitReference: 1,
    });

    return NextResponse.json({
      success: true,
      data: {
        qualification,
        units,
      },
    });
  } catch (error) {
    console.error('Error fetching qualification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
