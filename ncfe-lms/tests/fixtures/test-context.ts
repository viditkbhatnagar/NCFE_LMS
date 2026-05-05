import * as fs from 'fs';
import * as path from 'path';

interface BaselineUserIds {
  [email: string]: string;
}

let cached: BaselineUserIds | null = null;

export function getTestUserIds(): BaselineUserIds {
  if (cached) return cached;
  const file = path.join(__dirname, '..', 'baseline-user-ids.json');
  if (!fs.existsSync(file)) throw new Error(`baseline-user-ids.json not found at ${file}`);
  cached = JSON.parse(fs.readFileSync(file, 'utf8')) as BaselineUserIds;
  return cached;
}

export function uid(email: string): string {
  const id = getTestUserIds()[email];
  if (!id) throw new Error(`No baseline user id for ${email}`);
  return id;
}

export const KNOWN_IDS = {
  ASSESSOR_JYOTHI: () => uid('jyothi@learnerseducation.com'),
  STUDENT_VIDIT: () => uid('bhatnagar007vidit@gmail.com'),
  STUDENT_INTERN: () => uid('intern@learnerseducation.com'),
  IQA: () => uid('iqa@test.com'),
  ADMIN: () => uid('admin@learnerseducation.com'),
};

// Enrolment IDs — populated by `npx tsx tests/preflight.ts`. Hardcoded from
// snapshot: jyothi assesses 4 enrolments. We only touch the two for our test
// students (vidit + intern); the other two (legacy Phase 1 seed) are off-limits.
export const ENROLMENTS = {
  VIDIT: '699f17033efdb56250b0217a',
  INTERN: '699f17033efdb56250b0217d',
} as const;

export const QUALIFICATION_ID = '699f16ed3efdb56250b02098';

export const UNITS = {
  UNIT_301: '699f16ed3efdb56250b0209b',
  UNIT_302: '699f16f63efdb56250b020fe',
  UNIT_303: '699f16fa3efdb56250b02128',
} as const;
