import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import PersonalDocument from '@/models/PersonalDocument';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const folderId = searchParams.get('folderId');
    const fileType = searchParams.get('fileType');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify this learner belongs to the assessor's enrollments
    const enrollment = await Enrolment.findOne({
      userId,
      assessorId: session!.user.id,
    }).lean();

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Learner not found in your enrollments' },
        { status: 403 }
      );
    }

    const query: Record<string, unknown> = {
      userId,
      folderId: folderId || null,
    };

    if (fileType) {
      if (fileType === 'pdf') query.fileType = 'application/pdf';
      else if (fileType === 'doc')
        query.fileType = {
          $in: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
        };
      else if (fileType === 'image') query.fileType = { $regex: /^image\// };
      else if (fileType === 'video') query.fileType = { $regex: /^video\// };
    }

    const docs = await PersonalDocument.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ isFolder: -1, fileName: 1 })
      .lean();

    return NextResponse.json({ success: true, data: docs });
  } catch (err) {
    console.error('Error fetching personal documents:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
