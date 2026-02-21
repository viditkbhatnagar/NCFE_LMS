import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { uploadFile } from '@/lib/upload';
import { folderCreateSchema } from '@/lib/validators';
import CourseDoc from '@/models/CourseDocument';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const qualificationId = searchParams.get('qualificationId');
    const folderId = searchParams.get('folderId');
    const fileType = searchParams.get('fileType');

    if (!qualificationId) {
      return NextResponse.json(
        { success: false, error: 'qualificationId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify access based on role
    const user = session!.user;
    if (user.role === 'student') {
      const hasEnrollment = await Enrolment.exists({
        userId: user.id,
        qualificationId,
      });
      if (!hasEnrollment) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const query: Record<string, unknown> = {
      qualificationId,
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

    const docs = await CourseDoc.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ isFolder: -1, fileName: 1 })
      .lean();

    const data = docs.map((doc) => {
      if (doc.isFolder) return doc;
      return {
        ...doc,
        fileUrl: `/api/v2/course-documents/${doc._id.toString()}/download`,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching course documents:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const contentType = request.headers.get('content-type') || '';

    // JSON request = folder creation
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const parsed = folderCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const folder = await CourseDoc.create({
        qualificationId: parsed.data.qualificationId,
        fileName: parsed.data.fileName,
        folderId: parsed.data.folderId || null,
        isFolder: true,
        uploadedBy: session!.user.id,
      });

      const populated = await CourseDoc.findById(folder._id)
        .populate('uploadedBy', 'name email')
        .lean();

      return NextResponse.json(
        { success: true, data: populated },
        { status: 201 }
      );
    }

    // FormData request = file upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const qualificationId = formData.get('qualificationId') as string | null;
    const folderId = formData.get('folderId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    if (!qualificationId) {
      return NextResponse.json(
        { success: false, error: 'qualificationId is required' },
        { status: 400 }
      );
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
      qualificationId
    );

    const doc = await CourseDoc.create({
      qualificationId,
      fileName,
      fileUrl: filePath,
      fileType,
      fileSize,
      storageProvider,
      storageBucket,
      storageKey,
      folderId: folderId || null,
      isFolder: false,
      uploadedBy: session!.user.id,
    });

    const populated = await CourseDoc.findById(doc._id)
      .populate('uploadedBy', 'name email')
      .lean();

    const responseData = populated
      ? {
          ...populated,
          fileUrl: `/api/v2/course-documents/${populated._id.toString()}/download`,
        }
      : populated;

    return NextResponse.json({ success: true, data: responseData }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating course document:', err);
    const message =
      err instanceof Error &&
      (err.message.includes('50MB') || err.message.includes('not allowed'))
        ? err.message
        : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
