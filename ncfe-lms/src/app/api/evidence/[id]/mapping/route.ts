import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { evidenceMappingSchema } from '@/lib/validators';
import Evidence from '@/models/Evidence';
import EvidenceMapping from '@/models/EvidenceMapping';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import Enrolment from '@/models/Enrolment';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evidenceId } = await params;
    const { session, error } = await withAuth(['student']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { assessmentCriteriaIds } = body;

    // Validate input
    const validation = evidenceMappingSchema.safeParse({
      evidenceId,
      assessmentCriteriaIds,
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

    // Verify evidence exists
    const evidence = await Evidence.findById(evidenceId);

    if (!evidence) {
      return NextResponse.json(
        { success: false, error: 'Evidence not found' },
        { status: 404 }
      );
    }

    // Get enrolment to find learnerId and qualificationId
    const enrolment = await Enrolment.findById(evidence.enrolmentId);

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found' },
        { status: 404 }
      );
    }

    // Mark existing active mappings for this evidence as superseded
    await EvidenceMapping.updateMany(
      { evidenceId, status: 'active' },
      { status: 'superseded' }
    );

    // Fetch all AC documents to denormalize fields
    const acDocs = await AssessmentCriteria.find({
      _id: { $in: assessmentCriteriaIds.map((acId: string) => new mongoose.Types.ObjectId(acId)) },
    });

    if (acDocs.length !== assessmentCriteriaIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more Assessment Criteria not found' },
        { status: 404 }
      );
    }

    // Create new mapping entries
    const mappingDocs = acDocs.map((ac) => ({
      evidenceId: new mongoose.Types.ObjectId(evidenceId),
      assessmentCriteriaId: ac._id,
      unitId: ac.unitId,
      learningOutcomeId: ac.learningOutcomeId,
      qualificationId: ac.qualificationId,
      learnerId: new mongoose.Types.ObjectId(session!.user.id),
      status: 'active' as const,
    }));

    const createdMappings = await EvidenceMapping.insertMany(mappingDocs);

    await createAuditLog({
      userId: session!.user.id,
      action: 'evidence_mapping_created',
      entityType: 'EvidenceMapping',
      entityId: evidenceId,
      newValue: { assessmentCriteriaIds, count: createdMappings.length },
    });

    return NextResponse.json(
      { success: true, data: createdMappings },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating evidence mappings:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
