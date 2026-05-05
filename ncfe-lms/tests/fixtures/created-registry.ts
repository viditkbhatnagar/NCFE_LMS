import type { APIRequestContext } from '@playwright/test';
import mongoose from 'mongoose';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { RUN_ID } from '../run-id';
import '../env';

export type EntityKind =
  | 'assessment'
  | 'evidence'
  | 'course-document'
  | 'material'
  | 'work-hours'
  | 'personal-document'
  | 'iqa-sample'
  | 'iqa-decision'
  | 'standardisation'
  | 'iqa-document'
  | 'admin-user'
  | 'admin-qualification'
  | 'admin-unit'
  | 'admin-learning-outcome'
  | 'admin-assessment-criteria'
  | 'admin-enrolment'
  | 's3-object'
  | 'remark'
  | 'criteria-mapping'
  | 'evidence-mapping'
  | 'notification';

interface Entry {
  kind: EntityKind;
  id?: string;
  storageKey?: string;
  s3Bucket?: string;
  apiPath?: string; // explicit DELETE path; otherwise inferred from kind+id
  // Fallback: direct Mongo delete (only used when no API DELETE exists). The
  // filter MUST contain a regex/literal match on RUN_ID to keep us safe.
  mongo?: { collection: string; mustMatchRunId: boolean };
  // Optional parent context for assessments (for sub-resources)
  parentId?: string;
}

const API_PATHS: Partial<Record<EntityKind, (id: string) => string>> = {
  assessment: (id) => `/api/v2/assessments/${id}`,
  evidence: (id) => `/api/v2/evidence/${id}`,
  'course-document': (id) => `/api/v2/course-documents/${id}`,
  material: (id) => `/api/v2/materials/${id}`,
  'work-hours': (id) => `/api/v2/work-hours/${id}`,
  'personal-document': (id) => `/api/v2/personal-documents/${id}`,
  'iqa-sample': (id) => `/api/iqa/samples/${id}`,
  'iqa-decision': (id) => `/api/iqa/decisions/${id}`,
  standardisation: (id) => `/api/iqa/standardisation/${id}`,
  'iqa-document': (id) => `/api/iqa/documents/${id}`,
  'admin-user': (id) => `/api/v2/admin/users/${id}`,
  'admin-qualification': (id) => `/api/v2/admin/qualifications/${id}`,
  'admin-unit': (id) => `/api/v2/admin/units/${id}`,
  'admin-learning-outcome': (id) => `/api/v2/admin/learning-outcomes/${id}`,
  'admin-assessment-criteria': (id) => `/api/v2/admin/assessment-criteria/${id}`,
  'admin-enrolment': (id) => `/api/v2/admin/enrolments/${id}`,
};

// Kinds that have no API DELETE — fall back to direct Mongo delete.
// (The IQA + personal-doc kinds above gained API DELETE in Phase 1; their
// collections remain listed here as belt-and-braces fallbacks if the API call fails.)
const MONGO_FALLBACK: Partial<Record<EntityKind, string>> = {
  'personal-document': 'personaldocuments',
  'iqa-sample': 'iqasamples',
  'iqa-decision': 'iqadecisions',
  standardisation: 'standardisationrecords',
  'iqa-document': 'centredocuments',
  remark: 'remarks',
  notification: 'notifications',
  'criteria-mapping': 'assessmentcriteriamaps',
  'evidence-mapping': 'assessmentevidencemaps',
};

// When API DELETE fails (e.g. business rule rejects deletion of published
// assessments), we fall back to a RUN_ID-gated Mongo delete to avoid leaking
// test data. These collections allow the safety-net path:
const EMERGENCY_FALLBACK: Partial<Record<EntityKind, string>> = {
  assessment: 'assessments',
  evidence: 'evidences',
  'course-document': 'coursedocuments',
  material: 'learningmaterials',
  'work-hours': 'workhourslogs',
  'admin-user': 'users',
  'admin-qualification': 'qualifications',
  'admin-unit': 'units',
  'admin-learning-outcome': 'learningoutcomes',
  'admin-assessment-criteria': 'assessmentcriterias',
  'admin-enrolment': 'enrolments',
};

let mongoConn: typeof mongoose | null = null;
async function getMongo(): Promise<typeof mongoose> {
  if (mongoConn?.connection?.readyState === 1) return mongoConn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  mongoConn = await mongoose.connect(uri);
  return mongoConn;
}

let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  }
  return s3Client;
}

export interface CleanupResult {
  attempted: number;
  apiDeleted: number;
  mongoDeleted: number;
  s3Deleted: number;
  failures: { entry: Entry; error: string }[];
}

export class CreatedRegistry {
  private entries: Entry[] = [];

  track(entry: Entry): void {
    this.entries.push(entry);
  }

  trackAssessment(id: string): void {
    this.track({ kind: 'assessment', id });
  }
  trackEvidence(id: string, storageKey?: string): void {
    this.track({ kind: 'evidence', id, storageKey });
  }
  trackS3(storageKey: string): void {
    this.track({ kind: 's3-object', storageKey });
  }
  trackAdmin(kind: EntityKind, id: string): void {
    this.track({ kind, id });
  }

  size(): number {
    return this.entries.length;
  }

  async cleanup(request?: APIRequestContext): Promise<CleanupResult> {
    const result: CleanupResult = {
      attempted: this.entries.length,
      apiDeleted: 0,
      mongoDeleted: 0,
      s3Deleted: 0,
      failures: [],
    };
    // LIFO so children before parents
    const todo = [...this.entries].reverse();
    this.entries = [];

    for (const entry of todo) {
      try {
        if (entry.kind === 's3-object') {
          if (entry.storageKey) {
            await deleteS3Object(entry.storageKey, entry.s3Bucket);
            result.s3Deleted += 1;
          }
          continue;
        }
        const apiPathFn = API_PATHS[entry.kind];
        let apiSucceeded = false;
        if (apiPathFn && entry.id && request) {
          const path = entry.apiPath || apiPathFn(entry.id);
          const resp = await request.delete(path);
          if (resp.ok() || resp.status() === 404) {
            result.apiDeleted += 1;
            apiSucceeded = true;
            if (entry.storageKey) {
              await deleteS3Object(entry.storageKey, entry.s3Bucket).catch(() => {});
              result.s3Deleted += 1;
            }
            // Even when API delete succeeds, the app does NOT delete dependent
            // notifications (see route handler). Sweep them so postflight is clean.
            if (entry.kind === 'assessment' && entry.id) {
              await sweepAssessmentNotifications(entry.id).catch(() => {});
            }
            // The admin user DELETE is a SOFT delete (sets status=inactive) for
            // audit-trail reasons. We must additionally hard-delete the row so
            // the user count returns to baseline.
            if (entry.kind === 'admin-user' && entry.id) {
              await deleteByMongoIdGuarded('users', entry.id).catch((err) => {
                result.failures.push({ entry, error: `hard-delete fallback: ${err}` });
              });
            }
            // Same pattern for qualifications — the admin DELETE is a soft
            // delete (sets status=inactive). Hard-delete to return to baseline.
            if (entry.kind === 'admin-qualification' && entry.id) {
              await deleteByMongoIdGuarded('qualifications', entry.id).catch((err) => {
                result.failures.push({ entry, error: `hard-delete fallback: ${err}` });
              });
            }
            continue;
          }
          // API rejected — record but don't fail; fall through to emergency
          result.failures.push({
            entry,
            error: `DELETE ${path} returned ${resp.status()}: ${(await resp
              .text()
              .catch(() => '')).slice(0, 200)}`,
          });
        }
        if (apiSucceeded) continue;
        const fallbackColl = MONGO_FALLBACK[entry.kind] || EMERGENCY_FALLBACK[entry.kind];
        if (fallbackColl && entry.id) {
          // For assessments, cascade to dependent collections first.
          if (entry.kind === 'assessment') {
            await cascadeAssessment(entry.id);
          }
          await deleteByMongoIdGuarded(fallbackColl, entry.id);
          result.mongoDeleted += 1;
          if (entry.storageKey) {
            await deleteS3Object(entry.storageKey, entry.s3Bucket).catch(() => {});
            result.s3Deleted += 1;
          }
          continue;
        }
        result.failures.push({
          entry,
          error: `No cleanup strategy for kind=${entry.kind} id=${entry.id ?? '<none>'}`,
        });
      } catch (err) {
        result.failures.push({
          entry,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return result;
  }
}

async function sweepAssessmentNotifications(assessmentId: string): Promise<void> {
  const conn = await getMongo();
  const db = conn.connection.db!;
  let oid: mongoose.Types.ObjectId | null = null;
  try {
    oid = new mongoose.Types.ObjectId(assessmentId);
  } catch {
    /* ignore */
  }
  // Match notifications where entityId may be stored as a string OR ObjectId.
  const orClauses: object[] = [{ entityId: assessmentId }];
  if (oid) orClauses.push({ entityId: oid });
  await db.collection('notifications').deleteMany({ $or: orClauses });
  if (oid) {
    await db.collection('signoffs').deleteMany({ assessmentId: oid });
  }
}

async function cascadeAssessment(assessmentId: string): Promise<void> {
  const conn = await getMongo();
  const db = conn.connection.db!;
  const oid = new mongoose.Types.ObjectId(assessmentId);
  // Confirm the assessment is RUN_ID-tagged before cascading
  const ass = await db.collection('assessments').findOne({ _id: oid });
  if (!ass || !JSON.stringify(ass).includes(RUN_ID)) {
    throw new Error(
      `Refusing assessment cascade for ${assessmentId}: not RUN_ID tagged`,
    );
  }
  await db.collection('assessmentcriteriamaps').deleteMany({ assessmentId: oid });
  await db.collection('assessmentevidencemaps').deleteMany({ assessmentId: oid });
  await db.collection('signoffs').deleteMany({ assessmentId: oid });
  await db.collection('remarks').deleteMany({ assessmentId: oid });
  await db.collection('notifications').deleteMany({ entityId: assessmentId });
}

async function deleteByMongoIdGuarded(collection: string, id: string): Promise<void> {
  const conn = await getMongo();
  const db = conn.connection.db!;
  const oid = new mongoose.Types.ObjectId(id);
  // Strict guard: only delete if the document contains RUN_ID somewhere as a string.
  const doc = await db.collection(collection).findOne({ _id: oid });
  if (!doc) return;
  const json = JSON.stringify(doc);
  if (!json.includes(RUN_ID)) {
    throw new Error(
      `Refusing Mongo delete for ${collection}/${id}: document does not contain RUN_ID ${RUN_ID}`,
    );
  }
  await db.collection(collection).deleteOne({ _id: oid });
}

async function deleteS3Object(key: string, bucket?: string): Promise<void> {
  if (!key) return;
  const Bucket = bucket || process.env.AWS_S3_BUCKET;
  if (!Bucket) return;
  // Strict: only delete keys under uploads/<userId>/...
  const prefix = (process.env.AWS_S3_KEY_PREFIX || 'uploads').replace(/^\/+|\/+$/g, '');
  if (!key.startsWith(prefix + '/')) {
    throw new Error(`Refusing S3 delete: key ${key} not under expected prefix ${prefix}/`);
  }
  await getS3().send(new DeleteObjectCommand({ Bucket, Key: key }));
}

// Convenience hook for tests
export function createdRegistry(): CreatedRegistry {
  return new CreatedRegistry();
}
