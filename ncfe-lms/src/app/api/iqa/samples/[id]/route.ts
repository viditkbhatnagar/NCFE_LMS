import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import IQASample from '@/models/IQASample';
import IQADecision from '@/models/IQADecision';
import Evidence from '@/models/Evidence';
import AssessmentDecision from '@/models/AssessmentDecision';
import Submission from '@/models/Submission';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['iqa']);

    if (error) {
      return error;
    }

    await dbConnect();

    const sample = await IQASample.findById(id)
      .populate('assessorId', 'name email')
      .populate('learnerId', 'name email')
      .populate('unitId', 'title unitReference')
      .populate('qualificationId', 'title');

    if (!sample) {
      return NextResponse.json(
        { success: false, error: 'IQA sample not found' },
        { status: 404 }
      );
    }

    // Fetch linked IQA decisions for this sample
    const iqaDecisions = await IQADecision.find({ iqaSampleId: id })
      .populate('iqaUserId', 'name email')
      .sort({ createdAt: -1 });

    // Fetch submissions for the sampled learner + unit
    const submissions = await Submission.find({
      learnerId: sample.learnerId._id,
      unitId: sample.unitId._id,
    }).sort({ createdAt: -1 });

    const submissionIds = submissions.map((s) => s._id);

    // Fetch evidence from those submissions
    const evidenceIds = submissions.flatMap((s) => s.evidenceIds || []);
    const evidence = await Evidence.find({ _id: { $in: evidenceIds } });

    // Fetch assessment decisions for those submissions
    const assessmentDecisions = await AssessmentDecision.find({
      submissionId: { $in: submissionIds },
    })
      .populate('assessmentCriteriaId', 'acNumber description')
      .populate('assessorId', 'name email');

    return NextResponse.json({
      success: true,
      data: {
        sample,
        iqaDecisions,
        submissions,
        evidence,
        assessmentDecisions,
      },
    });
  } catch (err) {
    console.error('Error fetching IQA sample detail:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
