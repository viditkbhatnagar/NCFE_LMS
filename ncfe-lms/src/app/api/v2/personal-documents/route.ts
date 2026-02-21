import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { uploadFile } from '@/lib/upload';
import PersonalDocument from '@/models/PersonalDocument';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const fileType = searchParams.get('fileType');

    await dbConnect();

    const user = session!.user;
    let targetUserId: string;

    if (user.role === 'student') {
      // Students always see their own documents
      targetUserId = user.id;
    } else {
      // Assessors must specify which learner's docs to view
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'userId is required' },
          { status: 400 }
        );
      }

      // Verify this learner belongs to the assessor's enrollments
      const enrollment = await Enrolment.findOne({
        userId,
        assessorId: user.id,
      }).lean();

      if (!enrollment) {
        return NextResponse.json(
          { success: false, error: 'Learner not found in your enrollments' },
          { status: 403 }
        );
      }

      targetUserId = userId;
    }

    const query: Record<string, unknown> = {
      userId: targetUserId,
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

    const data = docs.map((doc) => {
      if (doc.isFolder) return doc;
      return {
        ...doc,
        fileUrl: `/api/v2/personal-documents/${doc._id.toString()}/download`,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching personal documents:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const user = session!.user;
    let targetUserId: string;

    if (user.role === 'student') {
      targetUserId = user.id;
    } else {
      const userId = formData.get('userId') as string | null;
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'userId is required' },
          { status: 400 }
        );
      }

      // Verify this learner belongs to the assessor's enrollments
      const enrollment = await Enrolment.findOne({
        userId,
        assessorId: user.id,
      }).lean();

      if (!enrollment) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      targetUserId = userId;
    }

    const {
      filePath,
      fileName,
      fileType,
      fileSize,
      storageProvider,
      storageBucket,
      storageKey,
    } = await uploadFile(
      file,
      targetUserId
    );

    const doc = await PersonalDocument.create({
      userId: targetUserId,
      fileName,
      fileUrl: filePath,
      fileType,
      fileSize,
      storageProvider,
      storageBucket,
      storageKey,
      folderId: folderId || null,
      isFolder: false,
      uploadedBy: user.id,
    });

    const populated = await PersonalDocument.findById(doc._id)
      .populate('uploadedBy', 'name email')
      .lean();

    const responseData = populated
      ? {
          ...populated,
          fileUrl: `/api/v2/personal-documents/${populated._id.toString()}/download`,
        }
      : populated;

    return NextResponse.json({ success: true, data: responseData }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating personal document:', err);
    const isValidation =
      err instanceof Error &&
      (err.message.includes('50MB') || err.message.includes('not allowed'));
    const message = isValidation ? err.message : 'Internal server error';
    const status = isValidation ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
