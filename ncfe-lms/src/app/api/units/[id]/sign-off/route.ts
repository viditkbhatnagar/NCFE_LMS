import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';
import Enrolment from '@/models/Enrolment';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: unitId } = await params;
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { learnerId, enrolmentId } = body;

    if (!learnerId || !enrolmentId) {
      return NextResponse.json(
        { success: false, error: 'learnerId and enrolmentId are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify the enrolment exists and the assessor is assigned
    const enrolment = await Enrolment.findOne({
      _id: enrolmentId,
      userId: learnerId,
      assessorId: session!.user.id,
    });

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found or you are not the assigned assessor' },
        { status: 404 }
      );
    }

    // Get all ACs for this unit
    const totalACs = await AssessmentCriteria.find({ unitId }).select('_id');

    if (totalACs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No assessment criteria found for this unit' },
        { status: 400 }
      );
    }

    const totalACIds = totalACs.map((ac) => ac._id.toString());

    // Get all 'met' decisions for this learner + unit
    const metDecisions = await AssessmentDecision.find({
      unitId,
      learnerId,
      decision: 'met',
    }).distinct('assessmentCriteriaId');

    const metACIds = metDecisions.map((id) => id.toString());

    // Verify ALL ACs have 'met' decisions
    const unmetACs = totalACIds.filter((acId) => !metACIds.includes(acId));

    if (unmetACs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot sign off unit: ${unmetACs.length} assessment criteria have not been met`,
          details: {
            totalACs: totalACIds.length,
            metACs: metACIds.length,
            unmetCount: unmetACs.length,
          },
        },
        { status: 400 }
      );
    }

    // Check if already signed off (irreversible - prevent duplicate sign-offs)
    // We mark sign-off by checking if an audit log entry already exists
    // Since this is irreversible, we use a specific audit action
    const existingSignOff = await import('@/models/AuditLog').then((mod) =>
      mod.default.findOne({
        action: 'unit_signed_off',
        entityType: 'Unit',
        entityId: unitId,
        'newValue.learnerId': learnerId,
      })
    );

    if (existingSignOff) {
      return NextResponse.json(
        { success: false, error: 'Unit has already been signed off for this learner' },
        { status: 409 }
      );
    }

    // Create the audit log for the sign-off (this IS the sign-off record - irreversible)
    await createAuditLog({
      userId: session!.user.id,
      action: 'unit_signed_off',
      entityType: 'Unit',
      entityId: unitId,
      newValue: {
        learnerId,
        enrolmentId,
        totalACs: totalACIds.length,
        metACs: metACIds.length,
        signedOffAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        unitId,
        learnerId,
        enrolmentId,
        totalACs: totalACIds.length,
        metACs: metACIds.length,
        signedOffAt: new Date().toISOString(),
        signedOffBy: session!.user.id,
      },
    });
  } catch (err) {
    console.error('Error signing off unit:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
