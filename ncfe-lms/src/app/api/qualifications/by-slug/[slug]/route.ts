import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/route-guard';
import dbConnect from '@/lib/db';
import Qualification from '@/models/Qualification';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { session, error } = await withAuth(['assessor']);
  if (error) return error;

  const { slug } = await params;

  try {
    await dbConnect();

    const qualification = await Qualification.findOne({ slug });

    if (!qualification) {
      return NextResponse.json(
        { success: false, error: 'Qualification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: qualification });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch qualification' },
      { status: 500 }
    );
  }
}
