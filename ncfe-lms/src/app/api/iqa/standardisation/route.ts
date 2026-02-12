import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import StandardisationRecord from '@/models/StandardisationRecord';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { title, date, attendees, minutes, outcomes } = body;

    if (!title || !date) {
      return NextResponse.json(
        { success: false, error: 'Title and date are required' },
        { status: 400 }
      );
    }

    if (attendees && !Array.isArray(attendees)) {
      return NextResponse.json(
        { success: false, error: 'Attendees must be an array of strings' },
        { status: 400 }
      );
    }

    await dbConnect();

    const record = await StandardisationRecord.create({
      title,
      date: new Date(date),
      attendees: attendees || [],
      minutes: minutes || '',
      outcomes: outcomes || '',
      centreId: session!.user.centreId,
      createdBy: session!.user.id,
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'standardisation_record_created',
      entityType: 'StandardisationRecord',
      entityId: record._id.toString(),
      newValue: { title, date },
    });

    return NextResponse.json(
      { success: true, data: record },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating standardisation record:', err);
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
    const sort = searchParams.get('sort') || '-date';
    const skip = (page - 1) * limit;

    await dbConnect();

    const filter: Record<string, unknown> = {};

    // Optionally filter by centre
    if (session!.user.centreId) {
      filter.centreId = session!.user.centreId;
    }

    const [records, total] = await Promise.all([
      StandardisationRecord.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email'),
      StandardisationRecord.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching standardisation records:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
