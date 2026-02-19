import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { deleteFile } from '@/lib/upload';
import { fileRenameSchema } from '@/lib/validators';
import CourseDoc from '@/models/CourseDocument';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const doc = await CourseDoc.findById(id)
      .populate('uploadedBy', 'name email')
      .lean();

    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Verify access based on role
    const Enrolment = (await import('@/models/Enrolment')).default;
    const user = session!.user;
    const enrollmentFilter =
      user.role === 'student'
        ? { qualificationId: doc.qualificationId, userId: user.id }
        : { qualificationId: doc.qualificationId, assessorId: user.id };
    const hasAccess = await Enrolment.exists(enrollmentFilter);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error('Error fetching course document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const parsed = fileRenameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed' },
        { status: 400 }
      );
    }

    await dbConnect();

    const existing = await CourseDoc.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const Enrolment = (await import('@/models/Enrolment')).default;
    const hasAccess = await Enrolment.exists({
      qualificationId: existing.qualificationId,
      assessorId: session!.user.id,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const doc = await CourseDoc.findByIdAndUpdate(
      id,
      { fileName: parsed.data.fileName },
      { new: true }
    )
      .populate('uploadedBy', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error('Error updating course document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function deleteRecursive(folderId: string) {
  const children = await CourseDoc.find({ folderId }).lean();
  for (const child of children) {
    if (child.isFolder) {
      await deleteRecursive(child._id.toString());
    } else if (child.fileUrl) {
      await deleteFile(child.fileUrl);
    }
  }
  await CourseDoc.deleteMany({ folderId });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    await dbConnect();

    const doc = await CourseDoc.findById(id).lean();
    if (!doc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const Enrolment = (await import('@/models/Enrolment')).default;
    const hasAccess = await Enrolment.exists({
      qualificationId: doc.qualificationId,
      assessorId: session!.user.id,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (doc.isFolder) {
      await deleteRecursive(id);
    } else if (doc.fileUrl) {
      await deleteFile(doc.fileUrl);
    }

    await CourseDoc.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting course document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
