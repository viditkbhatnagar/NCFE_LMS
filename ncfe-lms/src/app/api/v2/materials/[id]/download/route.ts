import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { getFileDownloadUrl } from '@/lib/upload';
import LearningMaterial from '@/models/LearningMaterial';
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

    const material = await LearningMaterial.findById(id).lean();
    if (!material || material.isFolder || !material.fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Material file not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    const enrollmentFilter =
      user.role === 'student'
        ? { qualificationId: material.qualificationId, userId: user.id }
        : { qualificationId: material.qualificationId, assessorId: user.id };
    const hasAccess = await Enrolment.exists(enrollmentFilter);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const url = await getFileDownloadUrl(material.fileUrl, {
      storageProvider: material.storageProvider as 'local' | 's3' | undefined,
      storageBucket: material.storageBucket,
      storageKey: material.storageKey,
      fileName: material.fileName || material.title,
    });

    const redirectTarget = url.startsWith('http') ? url : new URL(url, request.url).toString();
    return NextResponse.redirect(redirectTarget);
  } catch (err) {
    console.error('Error generating material download URL:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
