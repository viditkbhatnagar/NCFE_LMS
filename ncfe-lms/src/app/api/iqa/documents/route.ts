import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import CentreDocument from '@/models/CentreDocument';

const VALID_CATEGORIES = ['sampling_plan', 'iqa_report', 'cpd_record', 'action_plan', 'other'];

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { title, category, fileUrl, description } = body;

    if (!title || !category || !fileUrl) {
      return NextResponse.json(
        { success: false, error: 'Title, category, and fileUrl are required' },
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

    const document = await CentreDocument.create({
      title,
      category,
      fileUrl,
      description: description || '',
      centreId: session!.user.centreId,
      uploadedBy: session!.user.id,
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'centre_document_created',
      entityType: 'CentreDocument',
      entityId: document._id.toString(),
      newValue: { title, category },
    });

    return NextResponse.json(
      { success: true, data: document },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating centre document:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sort = searchParams.get('sort') || '-createdAt';
    const skip = (page - 1) * limit;

    await dbConnect();

    const filter: Record<string, unknown> = {};

    // Optional category filter
    const category = searchParams.get('category');
    if (category) filter.category = category;

    // Optionally filter by centre
    if (session!.user.centreId) {
      filter.centreId = session!.user.centreId;
    }

    const [documents, total] = await Promise.all([
      CentreDocument.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('uploadedBy', 'name email'),
      CentreDocument.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching centre documents:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
