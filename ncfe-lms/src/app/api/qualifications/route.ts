import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Qualification from '@/models/Qualification';

export async function GET() {
  try {
    await dbConnect();

    const qualifications = await Qualification.find({ status: 'active' }).sort({
      title: 1,
    });

    return NextResponse.json({
      success: true,
      data: qualifications,
    });
  } catch (error) {
    console.error('Error fetching qualifications:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
