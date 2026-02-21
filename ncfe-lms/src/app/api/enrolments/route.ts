import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import '@/models/Qualification';

export async function GET() {
  try {
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    const enrolments = await Enrolment.find({
      userId: session!.user.id,
    }).populate('qualificationId');

    return NextResponse.json({
      success: true,
      data: enrolments,
    });
  } catch (error) {
    console.error('Error fetching enrolments:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
