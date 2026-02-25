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

    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    const url = await getFileDownloadUrl(material.fileUrl, {
      storageProvider: material.storageProvider as 'local' | 's3' | undefined,
      storageBucket: material.storageBucket,
      storageKey: material.storageKey,
      fileName: isPreview ? undefined : (material.fileName || material.title),
    });

    const resolvedUrl = url.startsWith('http') ? url : new URL(url, request.url).toString();

    if (searchParams.get('json') === 'true') {
      return NextResponse.json({ success: true, url: resolvedUrl });
    }

    return NextResponse.redirect(resolvedUrl);
  } catch (err) {
    console.error('Error generating material download URL:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
