// Hard-delete cascade helpers used by the admin "Permanently delete" actions
// on /admin/users, /admin/qualifications, /admin/enrolments. Soft-delete
// remains the default in the UI; these run only when ?hard=true is passed.
//
// Audit logs are intentionally never cascaded — they preserve the trail of
// who did what, even after the subjects are gone.

import mongoose from 'mongoose';
import Enrolment from '@/models/Enrolment';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import AssessmentEvidenceMap from '@/models/AssessmentEvidenceMap';
import SignOff from '@/models/SignOff';
import Remark from '@/models/Remark';
import CriterionComment from '@/models/CriterionComment';
import Evidence from '@/models/Evidence';
import WorkHoursLog from '@/models/WorkHoursLog';
import Notification from '@/models/Notification';
import PersonalDocument from '@/models/PersonalDocument';
import User from '@/models/User';
import Qualification from '@/models/Qualification';
import Module from '@/models/Module';
import Unit from '@/models/Unit';
import LearningOutcome from '@/models/LearningOutcome';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import LearningMaterial from '@/models/LearningMaterial';
import CourseDocument from '@/models/CourseDocument';
import LiveSession from '@/models/LiveSession';
import { deleteFile } from '@/lib/upload';

type ID = mongoose.Types.ObjectId;

function oid(id: string | ID): ID {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

interface EvidenceLite {
  fileUrl?: string;
  storageProvider?: 'local' | 's3';
  storageBucket?: string;
  storageKey?: string;
  thumbnailStorageKey?: string;
}

async function softDeleteEvidenceFiles(rows: EvidenceLite[]): Promise<void> {
  for (const ev of rows) {
    try {
      if (ev.fileUrl) {
        await deleteFile(ev.fileUrl, {
          storageProvider: ev.storageProvider,
          storageBucket: ev.storageBucket,
          storageKey: ev.storageKey,
        });
      }
      if (ev.thumbnailStorageKey) {
        await deleteFile(`${ev.storageBucket ? `s3://${ev.storageBucket}/` : ''}${ev.thumbnailStorageKey}`, {
          storageProvider: ev.storageProvider,
          storageBucket: ev.storageBucket,
          storageKey: ev.thumbnailStorageKey,
        });
      }
    } catch {
      /* soft-fail; row deletion proceeds */
    }
  }
}

async function cascadeAssessmentsByIds(assessmentIds: ID[]): Promise<void> {
  if (assessmentIds.length === 0) return;
  await AssessmentCriteriaMap.deleteMany({ assessmentId: { $in: assessmentIds } });
  await AssessmentEvidenceMap.deleteMany({ assessmentId: { $in: assessmentIds } });
  await SignOff.deleteMany({ assessmentId: { $in: assessmentIds } });
  await Remark.deleteMany({ assessmentId: { $in: assessmentIds } });
  await CriterionComment.deleteMany({ assessmentId: { $in: assessmentIds } });
  await Notification.deleteMany({
    entityType: 'Assessment',
    entityId: { $in: assessmentIds },
  });
  await Assessment.deleteMany({ _id: { $in: assessmentIds } });
}

async function cascadeEnrolmentIds(enrolmentIds: ID[]): Promise<void> {
  if (enrolmentIds.length === 0) return;

  // Assessments + their children
  const assessments = await Assessment.find({ enrollmentId: { $in: enrolmentIds } })
    .select('_id')
    .lean();
  await cascadeAssessmentsByIds(assessments.map((a) => a._id));

  // Evidence + S3 files
  const evidence = await Evidence.find({ enrolmentId: { $in: enrolmentIds } })
    .select('fileUrl storageProvider storageBucket storageKey thumbnailStorageKey')
    .lean();
  await softDeleteEvidenceFiles(evidence as EvidenceLite[]);
  await Evidence.deleteMany({ enrolmentId: { $in: enrolmentIds } });

  // Work hours
  await WorkHoursLog.deleteMany({ enrollmentId: { $in: enrolmentIds } });

  // Finally the enrolments themselves
  await Enrolment.deleteMany({ _id: { $in: enrolmentIds } });
}

// ─── Public cascade entry points ───────────────────────────────────────────

export async function hardDeleteEnrolment(enrolmentId: string | ID): Promise<void> {
  await cascadeEnrolmentIds([oid(enrolmentId)]);
}

export async function hardDeleteUser(userId: string | ID): Promise<{
  enrolmentsCascaded: number;
  enrolmentsUnassigned: number;
}> {
  const uid = oid(userId);

  // 1. Cascade enrolments where this user was the student.
  const studentEnrolments = await Enrolment.find({ userId: uid }).select('_id').lean();
  const enrolIds = studentEnrolments.map((e) => e._id);
  await cascadeEnrolmentIds(enrolIds);

  // 2. Where they were an assessor (lead or co-assessor), keep the enrolment
  //    alive for reassignment.
  //    Order matters for crash-safety: re-lead FIRST (while uid is still in
  //    assessorIds), promoting the first OTHER assessor to lead; THEN pull uid
  //    from the array. If the process dies between the two steps, the critical
  //    field (assessorId, which a deleted user must never own) is already
  //    correct; a stale uid left in assessorIds is harmless (the user is gone)
  //    and the helper dedupes it away on read.
  const reled = await Enrolment.updateMany(
    { assessorId: uid },
    [
      {
        $set: {
          assessorId: {
            $ifNull: [
              {
                $first: {
                  $filter: {
                    input: { $ifNull: ['$assessorIds', []] },
                    as: 'a',
                    cond: { $ne: ['$$a', uid] },
                  },
                },
              },
              null,
            ],
          },
        },
      },
    ],
  );
  const pulled = await Enrolment.updateMany(
    { assessorIds: uid },
    { $pull: { assessorIds: uid } },
  );
  // Assessment ownership stays singular — unset the owner if it was them.
  await Assessment.updateMany(
    { assessorId: uid },
    { $unset: { assessorId: '' } },
  );

  // 3. Loose user-scoped rows.
  await Notification.deleteMany({ userId: uid });
  await PersonalDocument.deleteMany({ uploadedBy: uid });

  // 4. Remove from any course's assessorIds list.
  await Qualification.updateMany(
    { assessorIds: uid },
    { $pull: { assessorIds: uid } },
  );

  // 5. The user document.
  await User.findByIdAndDelete(uid);

  return {
    enrolmentsCascaded: enrolIds.length,
    enrolmentsUnassigned: (pulled.modifiedCount ?? 0) + (reled.modifiedCount ?? 0),
  };
}

export async function hardDeleteQualification(qualificationId: string | ID): Promise<{
  units: number;
  modules: number;
  enrolments: number;
}> {
  const qid = oid(qualificationId);

  // Cascade the curriculum tree
  const units = await Unit.find({ qualificationId: qid }).select('_id').lean();
  const unitIds = units.map((u) => u._id);
  const los = await LearningOutcome.find({ unitId: { $in: unitIds } })
    .select('_id')
    .lean();
  const loIds = los.map((l) => l._id);
  await AssessmentCriteria.deleteMany({ learningOutcomeId: { $in: loIds } });
  await LearningOutcome.deleteMany({ _id: { $in: loIds } });
  await Unit.deleteMany({ _id: { $in: unitIds } });
  const moduleResult = await Module.deleteMany({ qualificationId: qid });

  // Materials + course docs + live sessions on this course
  await LearningMaterial.deleteMany({ qualificationId: qid });
  await CourseDocument.deleteMany({ qualificationId: qid });
  await LiveSession.deleteMany({ qualificationId: qid });

  // Cascade all enrolments on this course (assessments / evidence / work-hours)
  const enrolments = await Enrolment.find({ qualificationId: qid }).select('_id').lean();
  const enrolIds = enrolments.map((e) => e._id);
  await cascadeEnrolmentIds(enrolIds);

  // The qualification itself
  await Qualification.findByIdAndDelete(qid);

  return {
    units: unitIds.length,
    modules: moduleResult.deletedCount ?? 0,
    enrolments: enrolIds.length,
  };
}
