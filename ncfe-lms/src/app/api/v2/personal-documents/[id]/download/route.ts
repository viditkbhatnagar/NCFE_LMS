import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { getFileDownloadUrl } from '@/lib/upload';
import PersonalDocument from '@/models/PersonalDocument';
import Enrolment from '@/models/Enrolment';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const doc = await PersonalDocument.findById(id).lean();
    if (!doc || doc.isFolder || !doc.fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Personal document file not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    let canAccess = false;

    if (user.role === 'student') {
      canAccess = doc.userId.toString() === user.id;
    } else {
      const enrollment = await Enrolment.findOne({
        userId: doc.userId,
        assessorId: user.id,
      }).lean();
      canAccess = !!enrollment;
    }

    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const url = await getFileDownloadUrl(doc.fileUrl, {
      storageProvider: doc.storageProvider as 'local' | 's3' | undefined,
      storageBucket: doc.storageBucket,
      storageKey: doc.storageKey,
      fileName: doc.fileName,
    });

    const redirectTarget = url.startsWith('http') ? url : new URL(url, request.url).toString();
    return NextResponse.redirect(redirectTarget);
  } catch (err) {
    console.error('Error generating personal document download URL:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
