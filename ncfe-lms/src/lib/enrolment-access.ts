import mongoose from 'mongoose';

// Multi-assessor-per-enrolment helpers.
//
// An Enrolment carries BOTH `assessorId` (the lead assessor, kept for
// backward compatibility) and `assessorIds` (the full set, including the
// lead). These helpers let read/access paths treat the two uniformly, so a
// secondary assessor gets the same visibility + access as the lead.

type IdLike =
  | mongoose.Types.ObjectId
  | string
  | { _id: mongoose.Types.ObjectId | string }
  | null
  | undefined;

function idStr(v: IdLike): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v instanceof mongoose.Types.ObjectId) return v.toString();
  if (typeof v === 'object' && '_id' in v && v._id) return String(v._id);
  return String(v);
}

interface EnrolmentLike {
  assessorId?: IdLike;
  assessorIds?: IdLike[];
}

/**
 * The full, de-duplicated set of assessor id strings for an enrolment —
 * the union of `assessorIds` and the legacy lead `assessorId`. Works on
 * lean docs, hydrated docs, and populated docs alike.
 */
export function enrolmentAssessorIds(enrolment: EnrolmentLike | null | undefined): string[] {
  const ids = new Set<string>();
  if (enrolment) {
    if (Array.isArray(enrolment.assessorIds)) {
      for (const a of enrolment.assessorIds) {
        const s = idStr(a);
        if (s) ids.add(s);
      }
    }
    const lead = idStr(enrolment.assessorId);
    if (lead) ids.add(lead);
  }
  return [...ids];
}

/** True if `userId` is any assessor (lead or secondary) on the enrolment. */
export function isEnrolmentAssessor(
  enrolment: EnrolmentLike | null | undefined,
  userId: string | mongoose.Types.ObjectId,
): boolean {
  return enrolmentAssessorIds(enrolment).includes(String(userId));
}

/**
 * A Mongo `$or` query fragment matching enrolments where `userId` is an
 * assessor — either in the `assessorIds` array OR the legacy `assessorId`
 * lead (so rows written before the multi-assessor change still match).
 *
 * Spread into a filter:  `{ qualificationId, ...assessorMatch(userId) }`
 */
export function assessorMatch(
  userId: string | mongoose.Types.ObjectId,
): { $or: Array<Record<string, unknown>> } {
  const oid = new mongoose.Types.ObjectId(String(userId));
  return { $or: [{ assessorIds: oid }, { assessorId: oid }] };
}

/**
 * Normalise an inbound assessor selection into the dual-field write shape.
 * Accepts the new `assessorIds` array and/or the legacy single `assessorId`,
 * dedupes, and derives the lead (assessorIds[0]).
 */
export function buildAssessorFields(input: {
  assessorIds?: string[];
  assessorId?: string;
}): { assessorIds: string[]; assessorId: string | undefined } {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (v?: string) => {
    if (v && !seen.has(v)) {
      seen.add(v);
      ids.push(v);
    }
  };
  // Lead first if provided explicitly, then the rest of the array.
  push(input.assessorId);
  for (const a of input.assessorIds ?? []) push(a);
  return { assessorIds: ids, assessorId: ids[0] };
}
