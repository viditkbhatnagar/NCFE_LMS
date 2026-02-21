import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { remarkActionSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import Remark from '@/models/Remark';
import { createNotification } from '@/lib/notifications';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }
    const userId = session!.user.id;
    const userRole = session!.user.role;
    if (userRole === 'student') {
      if (assessment.learnerId.toString() !== userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else if (assessment.assessorId.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const remarks = await Remark.find({ assessmentId: id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: remarks });
  } catch (err) {
    console.error('Error fetching remarks:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student']);
    if (error) return error;

    const body = await request.json();
    const validation = remarkActionSchema.safeParse(body);
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

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }
    const userId = session!.user.id;
    const userRole = session!.user.role;
    if (userRole === 'student') {
      if (assessment.learnerId.toString() !== userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else if (assessment.assessorId.toString() !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const remark = await Remark.create({
      assessmentId: id,
      content: validation.data.content,
      createdBy: session!.user.id,
    });

    const populated = await Remark.findById(remark._id)
      .populate('createdBy', 'name email')
      .lean();

    // Notify the other party about the new remark
    const userName = session!.user.name || 'A user';
    const assessmentTitle = assessment.title || 'an assessment';
    const recipientId =
      userRole === 'student'
        ? assessment.assessorId?.toString()
        : assessment.learnerId?.toString();

    if (recipientId) {
      createNotification({
        userId: recipientId,
        type: 'remark_added',
        title: 'New Remark',
        message: `${userName} commented on assessment "${assessmentTitle}"`,
        entityType: 'Assessment',
        entityId: id,
      });
    }

    return NextResponse.json(
      { success: true, data: populated },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating remark:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
