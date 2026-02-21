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

    if (!file) {
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

    // Upload file using the shared utility, keyed under the learner's userId
    const learnerId = enrollment.userId.toString();
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
      learnerId
    );

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
