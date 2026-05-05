import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import AssessmentEvidenceMap from '@/models/AssessmentEvidenceMap';
import SignOff from '@/models/SignOff';
import Remark from '@/models/Remark';
import '@/models/AssessmentCriteria';
import '@/models/Unit';
import '@/models/LearningOutcome';

interface PopulatedRef {
  _id?: { toString(): string };
  toString(): string;
}

function refId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const ref = value as PopulatedRef;
  return ref._id?.toString() ?? ref.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student', 'iqa', 'admin']);
    if (error) return error;

    await dbConnect();

    const assessment = await Assessment.findById(id)
      .populate('learnerId', 'name email')
      .populate('assessorId', 'name email')
      .populate('enrollmentId', 'cohortId')
      .lean();

    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const userId = session!.user.id;
    const role = session!.user.role;

    // Authorisation: assessor must own it OR be admin/iqa; student must be the learner
    if (role === 'student') {
      const learnerId = refId(assessment.learnerId);
      if (learnerId !== userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (role === 'assessor') {
      if (refId(assessment.assessorId) !== userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }
    // admin and iqa always allowed

    const [criteriaMap, evidenceMap, signOffs, remarks] = await Promise.all([
      AssessmentCriteriaMap.find({ assessmentId: id })
        .populate({
          path: 'criteriaId',
          populate: [
            { path: 'unitId', select: 'unitReference title' },
            { path: 'learningOutcomeId', select: 'loNumber description' },
          ],
        })
        .lean(),
      AssessmentEvidenceMap.find({ assessmentId: id })
        .populate('evidenceId')
        .lean(),
      SignOff.find({ assessmentId: id })
        .populate('signedOffBy', 'name email')
        .lean(),
      Remark.find({ assessmentId: id })
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).text('Assessment Record', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#666').text('NCFE LMS', { align: 'center' });
      doc.moveDown(1);

      // Assessment basics
      doc.fillColor('#000').fontSize(14).text(assessment.title || '(untitled)');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#444');
      const dateStr = assessment.date ? new Date(assessment.date).toLocaleDateString() : 'n/a';
      doc.text(`Date: ${dateStr}`);
      doc.text(`Kind: ${assessment.assessmentKind ?? 'n/a'}`);
      doc.text(`Status: ${assessment.status}`);
      const learner = assessment.learnerId as { name?: string; email?: string } | null | undefined;
      const assessor = assessment.assessorId as { name?: string; email?: string } | null | undefined;
      doc.text(`Learner: ${learner?.name ?? ''} (${learner?.email ?? ''})`);
      doc.text(`Assessor: ${assessor?.name ?? ''} (${assessor?.email ?? ''})`);
      doc.moveDown(1);

      // Plan sections
      doc.fillColor('#000').fontSize(12).text('Plan — Intent');
      doc.fontSize(10).fillColor('#222').text(assessment.planIntent || '(empty)', { paragraphGap: 8 });
      doc.fontSize(12).fillColor('#000').text('Plan — Implementation');
      doc.fontSize(10).fillColor('#222').text(assessment.planImplementation || '(empty)', { paragraphGap: 8 });
      doc.moveDown(0.5);

      // Criteria
      doc.fontSize(12).fillColor('#000').text('Mapped criteria');
      doc.moveDown(0.3);
      if (criteriaMap.length === 0) {
        doc.fontSize(10).fillColor('#666').text('No criteria mapped.');
      } else {
        for (const m of criteriaMap) {
          const c = m.criteriaId as {
            acNumber?: string;
            description?: string;
            unitId?: { unitReference?: string };
            learningOutcomeId?: { loNumber?: string };
          } | null;
          if (!c) continue;
          const unit = c.unitId?.unitReference ?? '';
          const lo = c.learningOutcomeId?.loNumber ?? '';
          doc
            .fontSize(10)
            .fillColor('#000')
            .text(`• ${unit} ${lo} ${c.acNumber ?? ''} — ${c.description ?? ''}`, {
              paragraphGap: 4,
            });
        }
      }
      doc.moveDown(0.5);

      // Evidence
      doc.fontSize(12).fillColor('#000').text('Mapped evidence');
      doc.moveDown(0.3);
      if (evidenceMap.length === 0) {
        doc.fontSize(10).fillColor('#666').text('No evidence mapped.');
      } else {
        for (const m of evidenceMap) {
          const e = m.evidenceId as {
            label?: string;
            fileName?: string;
            status?: string;
          } | null;
          if (!e) continue;
          doc
            .fontSize(10)
            .fillColor('#000')
            .text(`• ${e.label ?? '(unlabelled)'} — ${e.fileName ?? ''} [${e.status ?? ''}]`, {
              paragraphGap: 4,
            });
        }
      }
      doc.moveDown(0.5);

      // Sign-offs
      doc.fontSize(12).fillColor('#000').text('Sign-offs');
      doc.moveDown(0.3);
      if (signOffs.length === 0) {
        doc.fontSize(10).fillColor('#666').text('No sign-offs recorded.');
      } else {
        for (const s of signOffs) {
          const by = s.signedOffBy as { name?: string } | null | undefined;
          const at = s.signedOffAt ? new Date(s.signedOffAt).toLocaleDateString() : '—';
          doc
            .fontSize(10)
            .fillColor('#000')
            .text(`• ${s.role}: ${s.status} (by ${by?.name ?? '—'}, on ${at})`, {
              paragraphGap: 4,
            });
        }
      }
      doc.moveDown(0.5);

      // Remarks
      doc.fontSize(12).fillColor('#000').text('Remarks');
      doc.moveDown(0.3);
      if (remarks.length === 0) {
        doc.fontSize(10).fillColor('#666').text('No remarks recorded.');
      } else {
        for (const r of remarks) {
          const by = r.createdBy as { name?: string } | null | undefined;
          const when = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
          doc
            .fontSize(10)
            .fillColor('#000')
            .text(`${by?.name ?? 'Unknown'} (${when}): ${r.content}`, {
              paragraphGap: 6,
            });
        }
      }

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="assessment-${id}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Error generating assessment PDF:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
