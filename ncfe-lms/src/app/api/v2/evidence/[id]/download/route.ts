import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { getFileDownloadUrl } from '@/lib/upload';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa', 'admin']);
    if (error) return error;

    await dbConnect();

    const evidence = await Evidence.findById(id).lean();
    if (!evidence || !evidence.fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Evidence file not found' },
        { status: 404 }
      );
    }

    const user = session!.user;
    if (user.role !== 'iqa' && user.role !== 'admin') {
      const enrollment = await Enrolment.findById(evidence.enrolmentId).lean();
      if (!enrollment) {
        return NextResponse.json(
          { success: false, error: 'Enrollment not found' },
          { status: 404 }
        );
      }

      const canAccess =
        user.role === 'assessor'
          ? enrollment.assessorId?.toString() === user.id
          : enrollment.userId?.toString() === user.id;

      if (!canAccess) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    const url = await getFileDownloadUrl(evidence.fileUrl, {
      storageProvider: evidence.storageProvider as 'local' | 's3' | undefined,
      storageBucket: evidence.storageBucket,
      storageKey: evidence.storageKey,
      // Omit fileName for preview mode so the browser displays inline
      fileName: isPreview ? undefined : evidence.fileName,
    });

    const resolvedUrl = url.startsWith('http') ? url : new URL(url, request.url).toString();

    if (searchParams.get('json') === 'true') {
      return NextResponse.json({ success: true, url: resolvedUrl });
    }

    return NextResponse.redirect(resolvedUrl);
  } catch (err) {
    console.error('Error generating evidence download URL:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
