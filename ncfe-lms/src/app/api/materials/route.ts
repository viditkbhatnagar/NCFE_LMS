import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import LearningMaterial from '@/models/LearningMaterial';

const VALID_FILE_TYPES = ['pdf', 'pptx', 'video', 'template'];
const VALID_CATEGORIES = ['manual', 'slides', 'video', 'guidance', 'template'];

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor', 'iqa']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { title, description, fileUrl, fileType, category, unitId, qualificationId } = body;

    if (!title || !fileUrl || !fileType || !category || !qualificationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'title, fileUrl, fileType, category, and qualificationId are required',
        },
        { status: 400 }
      );
    }

    if (!VALID_FILE_TYPES.includes(fileType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid fileType. Must be one of: ${VALID_FILE_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const material = await LearningMaterial.create({
      title,
      description: description || '',
      fileUrl,
      fileType,
      category,
      unitId: unitId || undefined,
      qualificationId,
      uploadedBy: session!.user.id,
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'learning_material_created',
      entityType: 'LearningMaterial',
      entityId: material._id.toString(),
      newValue: {
        title,
        fileType,
        category,
        qualificationId,
      },
    });

    return NextResponse.json(
      { success: true, data: material },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating learning material:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
