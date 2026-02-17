import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';
import Unit from '@/models/Unit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const fileTypeFilter = searchParams.get('fileType');
    const sort = searchParams.get('sort') === 'oldest' ? 1 : -1;

    await dbConnect();

    // Verify enrollment belongs to this assessor
    const enrollment = await Enrolment.findById(enrollmentId).lean();
    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: 'Enrollment not found' },
        { status: 404 }
      );
    }
    if (enrollment.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Build evidence filter
    const filter: Record<string, unknown> = { enrolmentId: enrollmentId };
    if (statusFilter && ['draft', 'submitted', 'assessed'].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    if (fileTypeFilter) {
      const typeMap: Record<string, RegExp> = {
        pdf: /application\/pdf/,
        image: /image\//,
        video: /video\//,
        doc: /application\/(msword|vnd\.openxmlformats)/,
      };
      if (typeMap[fileTypeFilter]) {
        filter.fileType = typeMap[fileTypeFilter];
      }
    }

    const evidenceList = await Evidence.find(filter)
      .sort({ uploadedAt: sort as 1 | -1 })
      .lean();

    // Batch-fetch unit titles for populated unitId references
    const unitIds = [
      ...new Set(
        evidenceList
          .map((e) => e.unitId?.toString())
          .filter(Boolean) as string[]
      ),
    ];
    const units = await Unit.find({ _id: { $in: unitIds } })
      .select('unitReference title')
      .lean();
    const unitMap: Record<string, { unitReference: string; title: string }> = {};
    for (const u of units) {
      unitMap[u._id.toString()] = {
        unitReference: u.unitReference,
        title: u.title,
      };
    }

    const data = evidenceList.map((e) => {
      const unit = e.unitId ? unitMap[e.unitId.toString()] : undefined;
      return {
        _id: e._id.toString(),
        fileName: e.fileName,
        fileType: e.fileType,
        fileSize: e.fileSize || 0,
        fileUrl: e.fileUrl,
        label: e.label,
        description: e.description || '',
        status: e.status,
        uploadedAt: e.uploadedAt?.toISOString?.() || e.createdAt?.toISOString?.() || '',
        attemptNumber: e.attemptNumber || 1,
        unitId: e.unitId
          ? {
              _id: e.unitId.toString(),
              unitReference: unit?.unitReference ?? null,
              title: unit?.title ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Error fetching v2 portfolio:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
