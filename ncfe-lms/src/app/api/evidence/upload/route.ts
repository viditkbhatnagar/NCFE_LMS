import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { uploadFile } from '@/lib/upload';
import { evidenceUploadSchema } from '@/lib/validators';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['student']);

    if (error) {
      return error;
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const enrolmentId = formData.get('enrolmentId') as string;
    const unitId = formData.get('unitId') as string;
    const label = formData.get('label') as string;
    const description = (formData.get('description') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate metadata fields
    const validation = evidenceUploadSchema.safeParse({
      enrolmentId,
      unitId,
      label,
      description,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify the enrolment belongs to the current user
    const enrolment = await Enrolment.findOne({
      _id: enrolmentId,
      userId: session!.user.id,
    });

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found or not yours' },
        { status: 404 }
      );
    }

    // Upload file to disk
    const uploadResult = await uploadFile(file, session!.user.id);

    // Create evidence document
    const evidence = await Evidence.create({
      enrolmentId,
      unitId,
      fileUrl: uploadResult.filePath,
      fileName: uploadResult.fileName,
      fileType: uploadResult.fileType,
      fileSize: uploadResult.fileSize,
      label,
      description,
      status: 'draft',
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'evidence_uploaded',
      entityType: 'Evidence',
      entityId: evidence._id.toString(),
      newValue: { label, unitId, enrolmentId },
    });

    return NextResponse.json(
      { success: true, data: evidence },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error uploading evidence:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
