import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import StandardisationRecord from '@/models/StandardisationRecord';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await withAuth(['iqa']);
    if (error) return error;

    await dbConnect();

    const record = await StandardisationRecord.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Standardisation record not found' },
        { status: 404 }
      );
    }

    await StandardisationRecord.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting standardisation record:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
