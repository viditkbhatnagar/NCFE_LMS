import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { uploadFile } from '@/lib/upload';
import { materialFolderCreateSchema } from '@/lib/validators';
import LearningMaterial from '@/models/LearningMaterial';
import Enrolment from '@/models/Enrolment';

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const qualificationId = searchParams.get('qualificationId');
    const folderId = searchParams.get('folderId');
    const category = searchParams.get('category');
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

    if (category) query.category = category;

    if (fileType) {
      if (fileType === 'pdf') query.fileType = 'pdf';
      else if (fileType === 'pptx') query.fileType = 'pptx';
      else if (fileType === 'video') query.fileType = 'video';
      else if (fileType === 'template') query.fileType = 'template';
    }

    const materials = await LearningMaterial.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ isFolder: -1, title: 1 })
      .lean();

    const data = materials.map((material) => {
      if (material.isFolder) return material;
      return {
        ...material,
        fileUrl: `/api/v2/materials/${material._id.toString()}/download`,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching materials:', err);
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
      const parsed = materialFolderCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Validation failed' },
          { status: 400 }
        );
      }

      const folder = await LearningMaterial.create({
        qualificationId: parsed.data.qualificationId,
        title: parsed.data.title,
        folderId: parsed.data.folderId || null,
        isFolder: true,
        uploadedBy: session!.user.id,
      });

      const populated = await LearningMaterial.findById(folder._id)
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
    const title = formData.get('title') as string | null;
    const category = formData.get('category') as string | null;
    const description = (formData.get('description') as string) || '';

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
    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
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

    // Map MIME type to model's fileType enum
    let mappedFileType = '';
    if (fileType.includes('pdf')) mappedFileType = 'pdf';
    else if (fileType.includes('presentation') || fileName.endsWith('.pptx'))
      mappedFileType = 'pptx';
    else if (fileType.includes('video')) mappedFileType = 'video';
    else mappedFileType = 'other';

    const material = await LearningMaterial.create({
      qualificationId,
      title: title.trim(),
      description,
      fileUrl: filePath,
      fileName,
      fileType: mappedFileType,
      fileSize,
      storageProvider,
      storageBucket,
      storageKey,
      category: category || 'guidance',
      folderId: folderId || null,
      isFolder: false,
      uploadedBy: session!.user.id,
    });

    const populated = await LearningMaterial.findById(material._id)
      .populate('uploadedBy', 'name email')
      .lean();

    const responseData = populated
      ? {
          ...populated,
          fileUrl: `/api/v2/materials/${populated._id.toString()}/download`,
        }
      : populated;

    return NextResponse.json({ success: true, data: responseData }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating material:', err);
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
