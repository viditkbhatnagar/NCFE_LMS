import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Qualification from '@/models/Qualification';
import Unit from '@/models/Unit';
import LearningOutcome from '@/models/LearningOutcome';
import AssessmentCriteria from '@/models/AssessmentCriteria';

const bodySchema = z.object({
  csv: z.string().min(1),
});

interface ParsedRow {
  unitRef: string;
  loNum: string;
  acNum: string;
  desc: string;
  evidence: string;
}

function parseCsv(text: string): ParsedRow[] {
  const out: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return out;
  const startIdx = /unit\s*reference/i.test(lines[0]) ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (const c of lines[i]) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    fields.push(cur.trim());
    if (fields.length < 4) continue;
    const [unitRef, loNum, acNum, desc, evidence = ''] = fields;
    if (!unitRef || !loNum || !acNum || !desc) continue;
    out.push({ unitRef, loNum, acNum, desc, evidence });
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  const { id: qualificationId } = await params;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await dbConnect();

  const qual = await Qualification.findById(qualificationId);
  if (!qual) {
    return NextResponse.json({ success: false, error: 'Qualification not found' }, { status: 404 });
  }

  const rows = parseCsv(parsed.data.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid rows detected in the CSV.' },
      { status: 400 }
    );
  }

  const counts = {
    created: { units: 0, los: 0, acs: 0 },
    skipped: { units: 0, los: 0, acs: 0 },
  };

  const unitByRef = new Map<string, string>(); // unitRef -> _id
  const loByKey = new Map<string, string>(); // `${unitId}::${loNum}` -> _id

  for (const row of rows) {
    // Unit (deduped by unitReference within qualification)
    let unitId = unitByRef.get(row.unitRef);
    if (!unitId) {
      const existingUnit = await Unit.findOne({ qualificationId, unitReference: row.unitRef });
      if (existingUnit) {
        unitId = String(existingUnit._id);
        counts.skipped.units += 1;
      } else {
        const created = await Unit.create({
          qualificationId,
          unitReference: row.unitRef,
          title: row.unitRef, // CSV doesn't carry a unit title separately; fall back to ref
          description: '',
        });
        unitId = String(created._id);
        counts.created.units += 1;
      }
      unitByRef.set(row.unitRef, unitId);
    }

    // LO (deduped by loNumber within unit)
    const loKey = `${unitId}::${row.loNum}`;
    let loId = loByKey.get(loKey);
    if (!loId) {
      const existingLo = await LearningOutcome.findOne({ unitId, loNumber: row.loNum });
      if (existingLo) {
        loId = String(existingLo._id);
        counts.skipped.los += 1;
      } else {
        const created = await LearningOutcome.create({
          unitId,
          loNumber: row.loNum,
          description: row.loNum, // CSV doesn't carry an LO description; fall back to number
        });
        loId = String(created._id);
        counts.created.los += 1;
      }
      loByKey.set(loKey, loId);
    }

    // AC (deduped by acNumber within LO)
    const existingAc = await AssessmentCriteria.findOne({ learningOutcomeId: loId, acNumber: row.acNum });
    if (existingAc) {
      counts.skipped.acs += 1;
    } else {
      await AssessmentCriteria.create({
        learningOutcomeId: loId,
        unitId,
        qualificationId,
        acNumber: row.acNum,
        description: row.desc,
        evidenceRequirements: row.evidence,
      });
      counts.created.acs += 1;
    }
  }

  await createAuditLog({
    userId: session!.user.id,
    action: 'CURRICULUM_IMPORTED',
    entityType: 'Qualification',
    entityId: qualificationId,
    newValue: counts,
  });

  return NextResponse.json({ success: true, data: counts });
}
