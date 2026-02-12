import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import IQASample from '@/models/IQASample';
import IQADecision from '@/models/IQADecision';
import User from '@/models/User';
import AuditLog from '@/models/AuditLog';

export async function GET() {
  try {
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    // 1. Sampling coverage %: what % of assessors have been sampled
    const totalAssessors = await User.countDocuments({ role: 'assessor', status: 'active' });
    const sampledAssessors = await IQASample.distinct('assessorId');
    const samplingCoveragePercent =
      totalAssessors > 0
        ? Math.round((sampledAssessors.length / totalAssessors) * 100)
        : 0;

    // 2. All actions closed %: IQA decisions with action_required that have been resolved
    const totalActionRequired = await IQADecision.countDocuments({
      decision: 'action_required',
    });
    // Find samples linked to action_required decisions that are now 'completed'
    const actionRequiredDecisions = await IQADecision.find({
      decision: 'action_required',
    }).select('iqaSampleId');
    const actionSampleIds = actionRequiredDecisions.map((d) => d.iqaSampleId);
    const closedActions = await IQASample.countDocuments({
      _id: { $in: actionSampleIds },
      status: 'completed',
    });
    const actionsClosedPercent =
      totalActionRequired > 0
        ? Math.round((closedActions / totalActionRequired) * 100)
        : 100;

    // 3. Decision consistency: % of IQA decisions that are 'approved'
    const totalDecisions = await IQADecision.countDocuments();
    const approvedDecisions = await IQADecision.countDocuments({ decision: 'approved' });
    const decisionConsistencyPercent =
      totalDecisions > 0
        ? Math.round((approvedDecisions / totalDecisions) * 100)
        : 0;

    // 4. Audit trail completeness: % of samples that have at least one IQA decision
    const totalSamples = await IQASample.countDocuments();
    const samplesWithDecisions = await IQADecision.distinct('iqaSampleId');
    const auditTrailCompletenessPercent =
      totalSamples > 0
        ? Math.round((samplesWithDecisions.length / totalSamples) * 100)
        : 0;

    // 5. Stage coverage: check all 3 stages are represented
    const stagesCovered = await IQASample.distinct('stage');
    const allStages = ['early', 'mid', 'late'];
    const missingStages = allStages.filter((s) => !(stagesCovered as string[]).includes(s));

    // 6. Total audit log entries related to IQA
    const iqaAuditCount = await AuditLog.countDocuments({
      entityType: { $in: ['IQASample', 'IQADecision'] },
    });

    return NextResponse.json({
      success: true,
      data: {
        samplingCoverage: {
          percent: samplingCoveragePercent,
          sampledAssessors: sampledAssessors.length,
          totalAssessors,
        },
        actionsClosed: {
          percent: actionsClosedPercent,
          closed: closedActions,
          total: totalActionRequired,
        },
        decisionConsistency: {
          percent: decisionConsistencyPercent,
          approved: approvedDecisions,
          total: totalDecisions,
        },
        auditTrailCompleteness: {
          percent: auditTrailCompletenessPercent,
          samplesWithDecisions: samplesWithDecisions.length,
          totalSamples,
        },
        stageCoverage: {
          covered: stagesCovered,
          missing: missingStages,
          allCovered: missingStages.length === 0,
        },
        iqaAuditLogEntries: iqaAuditCount,
      },
    });
  } catch (err) {
    console.error('Error fetching EQA readiness:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
