import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { deleteFile } from '@/lib/upload';
import { fileRenameSchema } from '@/lib/validators';
import LearningMaterial from '@/models/LearningMaterial';

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

    const existing = await LearningMaterial.findById(id).lean();
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Material not found' },
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

    const material = await LearningMaterial.findByIdAndUpdate(
      id,
      { title: parsed.data.fileName, fileName: parsed.data.fileName },
      { new: true }
    )
      .populate('uploadedBy', 'name email')
      .lean();

    return NextResponse.json({ success: true, data: material });
  } catch (err) {
    console.error('Error updating material:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function deleteRecursive(folderId: string) {
  const errors: Error[] = [];
  const children = await LearningMaterial.find({ folderId }).lean();
  for (const child of children) {
    try {
      if (child.isFolder) {
        await deleteRecursive(child._id.toString());
      } else if (child.fileUrl) {
        await deleteFile(child.fileUrl);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }
  await LearningMaterial.deleteMany({ folderId });
  if (errors.length > 0) {
    console.error(`deleteRecursive: ${errors.length} error(s) in folder ${folderId}`, errors);
  }
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

    const material = await LearningMaterial.findById(id).lean();
    if (!material) {
      return NextResponse.json(
        { success: false, error: 'Material not found' },
        { status: 404 }
      );
    }

    const Enrolment = (await import('@/models/Enrolment')).default;
    const hasAccess = await Enrolment.exists({
      qualificationId: material.qualificationId,
      assessorId: session!.user.id,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (material.isFolder) {
      await deleteRecursive(id);
    } else if (material.fileUrl) {
      await deleteFile(material.fileUrl);
    }

    await LearningMaterial.findByIdAndDelete(id);

    return NextResponse.json({ success: true, data: { deleted: id } });
  } catch (err) {
    console.error('Error deleting material:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
