import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { deleteFile } from '@/lib/upload';
import PersonalDocument from '@/models/PersonalDocument';
import Enrolment from '@/models/Enrolment';
import { assessorMatch } from '@/lib/enrolment-access';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const doc = await PersonalDocument.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    const ownerId = doc.userId.toString();

    if (user.role === 'student') {
      if (ownerId !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else {
      const hasAccess = await Enrolment.exists({
        userId: ownerId,
        ...assessorMatch(user.id),
      });
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    if (!doc.isFolder && doc.fileUrl) {
      await deleteFile(doc.fileUrl, {
        storageProvider: doc.storageProvider as 'local' | 's3' | undefined,
        storageBucket: doc.storageBucket,
        storageKey: doc.storageKey,
      });
    }

    await PersonalDocument.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting personal document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
