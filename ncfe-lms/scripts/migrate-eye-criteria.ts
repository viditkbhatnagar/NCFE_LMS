/* eslint-disable no-console */
// One-off migration: the EYE qualification's assessment criteria were entered as
// Learning Outcomes (loNumber "LO1 - 1.1" etc.) with ZERO AssessmentCriteria, so
// the criteria-mapping modal had nothing clickable. This restructures them into
// the correct Unit -> LearningOutcome -> AssessmentCriteria shape.
//
// Safe: 0 AssessmentCriteriaMap rows reference the old LO ids (verified). The
// criteria DESCRIPTIONS are copied verbatim from the existing records — only the
// two parent LO TITLES are derived summaries (the original data had none) and the
// duplicate "LO2 - 2.1" second criterion is numbered 2.2.

import mongoose from 'mongoose';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='))!.slice('MONGODB_URI='.length).trim();
const EYE = '6a1e8c5ed76d3d201c54cf81';

// Old (mis-entered) LO _id -> target { lo group, acNumber }.
const PLAN: Record<string, { group: 'LO1' | 'LO2'; acNumber: string }> = {
  '6a1e8dddd76d3d201c54cfc6': { group: 'LO1', acNumber: '1.1' },
  '6a1e8e10d76d3d201c54cfce': { group: 'LO1', acNumber: '1.2' },
  '6a1e8e8ed76d3d201c54cfdc': { group: 'LO2', acNumber: '2.1' },
  '6a1e8ea5d76d3d201c54cfe2': { group: 'LO2', acNumber: '2.2' },
};

// Derived parent LO titles (summaries of the contained criteria). Editable later.
const LO_TITLES: Record<'LO1' | 'LO2', string> = {
  LO1: 'Understand the professional role and responsibilities of the early years educator',
  LO2: 'Be able to reflect on prior learning and experience in relation to the role of the early years educator',
};

(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const qid = new mongoose.Types.ObjectId(EYE);
  const now = new Date();

  const unit = await db.collection('units').findOne({ qualificationId: qid });
  if (!unit) throw new Error('EYE unit not found');
  const unitId = unit._id;
  console.log('Unit:', unit.unitReference, '-', unit.title, String(unitId));

  // Idempotency guard.
  const existingAcs = await db.collection('assessmentcriterias').countDocuments({ qualificationId: qid });
  if (existingAcs > 0) {
    console.log(`Already has ${existingAcs} assessment criteria — aborting (already migrated).`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // Pull the old LO records (for verbatim descriptions).
  const oldIds = Object.keys(PLAN).map((id) => new mongoose.Types.ObjectId(id));
  const oldLos = await db.collection('learningoutcomes').find({ _id: { $in: oldIds } }).toArray();
  if (oldLos.length !== oldIds.length) throw new Error(`Expected ${oldIds.length} old LOs, found ${oldLos.length}`);
  const descById = new Map(oldLos.map((l) => [String(l._id), l.description as string]));

  // 1. Create the two parent LearningOutcomes.
  const loDocs = (['LO1', 'LO2'] as const).map((g) => ({
    _id: new mongoose.Types.ObjectId(),
    unitId,
    loNumber: g,
    description: LO_TITLES[g],
    createdAt: now,
    updatedAt: now,
  }));
  await db.collection('learningoutcomes').insertMany(loDocs);
  const loIdByGroup = new Map(loDocs.map((d) => [d.loNumber, d._id]));
  console.log('Created parent LOs:', loDocs.map((d) => `${d.loNumber} (${String(d._id)})`).join(', '));

  // 2. Create the AssessmentCriteria, descriptions copied verbatim.
  const acDocs = Object.entries(PLAN).map(([oldId, t]) => ({
    _id: new mongoose.Types.ObjectId(),
    learningOutcomeId: loIdByGroup.get(t.group)!,
    unitId,
    qualificationId: qid,
    acNumber: t.acNumber,
    description: descById.get(oldId)!,
    evidenceRequirements: '',
    createdAt: now,
    updatedAt: now,
  }));
  await db.collection('assessmentcriterias').insertMany(acDocs);
  console.log('Created ACs:', acDocs.map((d) => `${d.acNumber}`).join(', '));

  // 3. Delete the 4 mis-entered LO records (verified: nothing references them).
  const del = await db.collection('learningoutcomes').deleteMany({ _id: { $in: oldIds } });
  console.log('Deleted old mis-entered LOs:', del.deletedCount);

  // 4. Verify the resulting tree.
  const los = await db.collection('learningoutcomes').find({ unitId }).sort({ loNumber: 1 }).toArray();
  console.log('\n=== Resulting structure ===');
  for (const lo of los) {
    const acs = await db.collection('assessmentcriterias').find({ learningOutcomeId: lo._id }).sort({ acNumber: 1 }).toArray();
    console.log(`${lo.loNumber} — ${lo.description}`);
    for (const ac of acs) console.log(`    ${ac.acNumber}  ${String(ac.description).slice(0, 70)}${ac.description.length > 70 ? '…' : ''}`);
  }

  await mongoose.disconnect();
  console.log('\nMigration complete.');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
