import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Enrolment from '@/models/Enrolment';
import Unit from '@/models/Unit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import AssessmentDecision from '@/models/AssessmentDecision';
import AuditLog from '@/models/AuditLog';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enrolmentId: string }> }
) {
  try {
    const { enrolmentId } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    const enrolment = await Enrolment.findById(enrolmentId)
      .populate('qualificationId')
      .populate('userId', 'name email');

    if (!enrolment) {
      return NextResponse.json(
        { success: false, error: 'Enrolment not found' },
        { status: 404 }
      );
    }

    const user = session!.user;

    // Access control: students can only view their own enrolment
    if (user.role === 'student' && enrolment.userId._id.toString() !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: not your enrolment' },
        { status: 403 }
      );
    }

    // Assessors can only view enrolments assigned to them
    if (user.role === 'assessor' && enrolment.assessorId?.toString() !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: learner not assigned to you' },
        { status: 403 }
      );
    }

    const qualificationId = enrolment.qualificationId._id;
    const learnerId = enrolment.userId._id;

    // Get all units for the qualification
    const units = await Unit.find({ qualificationId }).sort({ unitReference: 1 });

    // Build per-unit progress
    const unitProgress = await Promise.all(
      units.map(async (unit) => {
        const totalACs = await AssessmentCriteria.countDocuments({ unitId: unit._id });

        const metDecisions = await AssessmentDecision.find({
          unitId: unit._id,
          learnerId,
          decision: 'met',
        }).distinct('assessmentCriteriaId');

        const metACs = metDecisions.length;

        // Check if unit has been signed off (via audit log)
        const signOff = await AuditLog.findOne({
          action: 'unit_signed_off',
          entityType: 'Unit',
          entityId: unit._id,
          'newValue.learnerId': learnerId.toString(),
        });

        return {
          unitId: unit._id,
          unitReference: unit.unitReference,
          title: unit.title,
          totalACs,
          metACs,
          progress: totalACs > 0 ? Math.round((metACs / totalACs) * 100) : 0,
          isComplete: totalACs > 0 && metACs >= totalACs,
          isSignedOff: !!signOff,
          signedOffAt: signOff ? signOff.timestamp : null,
        };
      })
    );

    // Calculate overall totals
    const totalACs = unitProgress.reduce((sum, u) => sum + u.totalACs, 0);
    const totalMetACs = unitProgress.reduce((sum, u) => sum + u.metACs, 0);
    const completedUnits = unitProgress.filter((u) => u.isComplete).length;
    const signedOffUnits = unitProgress.filter((u) => u.isSignedOff).length;

    return NextResponse.json({
      success: true,
      data: {
        enrolmentId,
        learner: enrolment.userId,
        qualification: enrolment.qualificationId,
        status: enrolment.status,
        overallProgress: totalACs > 0 ? Math.round((totalMetACs / totalACs) * 100) : 0,
        totalACs,
        metACs: totalMetACs,
        totalUnits: units.length,
        completedUnits,
        signedOffUnits,
        units: unitProgress,
      },
    });
  } catch (err) {
    console.error('Error fetching qualification progress:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
