import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { getFileDownloadUrl } from '@/lib/upload';
import CourseDoc from '@/models/CourseDocument';
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

    const doc = await CourseDoc.findById(id).lean();
    if (!doc || doc.isFolder || !doc.fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Document file not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    const enrollmentFilter =
      user.role === 'student'
        ? { qualificationId: doc.qualificationId, userId: user.id }
        : { qualificationId: doc.qualificationId, assessorId: user.id };
    const hasAccess = await Enrolment.exists(enrollmentFilter);
    if (!hasAccess) {
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
    console.error('Error generating course document download URL:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
