import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { deleteFile } from '@/lib/upload';
import CentreDocument from '@/models/CentreDocument';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await withAuth(['iqa']);
    if (error) return error;

    await dbConnect();

    const doc = await CentreDocument.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Centre document not found' },
        { status: 404 }
      );
    }

    if (doc.fileUrl) {
      await deleteFile(doc.fileUrl, {
        storageProvider: doc.storageProvider as 'local' | 's3' | undefined,
        storageBucket: doc.storageBucket,
        storageKey: doc.storageKey,
      });
    }

    await CentreDocument.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting centre document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
