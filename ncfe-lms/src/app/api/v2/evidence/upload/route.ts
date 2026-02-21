import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { uploadFile } from '@/lib/upload';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const enrolmentId = formData.get('enrolmentId') as string | null;
    const label = formData.get('label') as string | null;
    const description = (formData.get('description') as string) || '';
    const unitId = formData.get('unitId') as string | null;

    // Check if file was pre-uploaded via presigned URL
    const preUploadedKey = formData.get('storageKey') as string | null;
    const preUploadedBucket = formData.get('storageBucket') as string | null;
    const preUploadedFileName = formData.get('fileName') as string | null;
    const preUploadedFileType = formData.get('fileType') as string | null;
    const preUploadedFileSize = formData.get('fileSize') as string | null;

    const isPreUploaded = !!preUploadedKey;

    if (!file && !isPreUploaded) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    if (!label?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Label is required' },
        { status: 400 }
      );
    }
    if (!enrolmentId) {
      return NextResponse.json(
        { success: false, error: 'enrolmentId is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify enrollment belongs to this assessor
    const enrollment = await Enrolment.findById(enrolmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    const user = session!.user;
    const isOwner =
      user.role === 'assessor'
        ? enrollment.assessorId?.toString() === user.id
        : enrollment.userId?.toString() === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    let filePath: string, fileName: string, fileType: string, fileSize: number;
    let storageProvider: string, storageBucket: string | undefined, storageKey: string | undefined;

    if (isPreUploaded) {
      // File already uploaded to S3 via presigned URL
      filePath = `s3://${preUploadedBucket}/${preUploadedKey}`;
      fileName = preUploadedFileName || 'unknown';
      fileType = preUploadedFileType || 'application/octet-stream';
      fileSize = Number(preUploadedFileSize) || 0;
      storageProvider = 's3';
      storageBucket = preUploadedBucket || undefined;
      storageKey = preUploadedKey || undefined;
    } else {
      // Upload file using the shared utility
      const learnerId = enrollment.userId.toString();
      const result = await uploadFile(file!, learnerId);
      filePath = result.filePath;
      fileName = result.fileName;
      fileType = result.fileType;
      fileSize = result.fileSize;
      storageProvider = result.storageProvider;
      storageBucket = result.storageBucket;
      storageKey = result.storageKey;
    }

    const evidence = await Evidence.create({
      enrolmentId,
      unitId: unitId || undefined,
      fileUrl: filePath,
      fileName,
      fileType,
      fileSize,
      storageProvider,
      storageBucket,
      storageKey,
      label: label.trim(),
      description,
      uploadedAt: new Date(),
      status: 'submitted',
    });

    const evidenceId = evidence._id.toString();

    // Notify the learner when assessor uploads evidence
    if (user.role === 'assessor') {
      const learnerId = enrollment.userId?.toString();
      if (learnerId) {
        createNotification({
          userId: learnerId,
          type: 'evidence_uploaded',
          title: 'New Evidence',
          message: `Your assessor uploaded evidence: ${label.trim()}`,
          entityType: 'Evidence',
          entityId: evidenceId,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: evidenceId,
          fileName: evidence.fileName,
          fileType: evidence.fileType,
          fileSize: evidence.fileSize,
          fileUrl: `/api/v2/evidence/${evidenceId}/download`,
          label: evidence.label,
          status: evidence.status,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Error uploading evidence (v2):', err);
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
