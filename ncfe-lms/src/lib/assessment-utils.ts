import type { AssessmentKind, AssessmentListItem } from '@/types';

export const TYPE_CONFIG: Record<
  AssessmentKind,
  { label: string; short: string; color: string }
> = {
  observation: { label: 'Observation', short: 'OB', color: '#7C3AED' },
  professional_discussion: { label: 'Professional Discussion', short: 'PD', color: '#2563EB' },
  reflective_account: { label: 'Reflective Account', short: 'RA', color: '#059669' },
  verbal_assessment: { label: 'Verbal Assessment', short: 'VA', color: '#D97706' },
  written_assessment: { label: 'Written Assessment', short: 'WA', color: '#DC2626' },
  work_product: { label: 'Work Product', short: 'WP', color: '#8B5CF6' },
  witness_testimony: { label: 'Witness Testimony', short: 'WT', color: '#0891B2' },
};

export function formatAssessmentDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export interface AssessmentFolder {
  key: string;
  label: string;
  items: AssessmentListItem[];
}

// Groups assessments into folders for the folder-wise view: one folder per
// learner (for individually-assigned assessments), plus a single "All learners"
// folder holding every copy that was assigned to the whole cohort (audience='all').
export function groupIntoFolders(assessments: AssessmentListItem[]): AssessmentFolder[] {
  const allLearners = assessments.filter((a) => a.audience === 'all');
  const single = assessments.filter((a) => a.audience !== 'all');

  const byLearner = new Map<string, { name: string; items: AssessmentListItem[] }>();
  for (const a of single) {
    const lid = a.learnerId?._id || 'unknown';
    const name = a.learnerId?.name || 'Unknown learner';
    if (!byLearner.has(lid)) byLearner.set(lid, { name, items: [] });
    byLearner.get(lid)!.items.push(a);
  }

  const learnerFolders: AssessmentFolder[] = [...byLearner.entries()]
    .map(([lid, v]) => ({ key: `learner:${lid}`, label: v.name, items: v.items }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const folders: AssessmentFolder[] = [];
  if (allLearners.length > 0) {
    folders.push({ key: 'all', label: 'All learners', items: allLearners });
  }
  folders.push(...learnerFolders);
  return folders;
}

export function groupByTimePeriod(
  assessments: AssessmentListItem[]
): { label: string; items: AssessmentListItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: Record<string, AssessmentListItem[]> = {};
  const order: string[] = [];

  for (const a of assessments) {
    const date = new Date(a.date);
    const aDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let label: string;
    if (aDay.getTime() === today.getTime()) {
      label = 'TODAY';
    } else if (aDay.getTime() === yesterday.getTime()) {
      label = 'YESTERDAY';
    } else if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      label = 'THIS MONTH';
    } else if (
      (now.getMonth() > 0 && date.getMonth() === now.getMonth() - 1 && date.getFullYear() === now.getFullYear()) ||
      (now.getMonth() === 0 && date.getMonth() === 11 && date.getFullYear() === now.getFullYear() - 1)
    ) {
      label = 'LAST MONTH';
    } else {
      label = date
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        .toUpperCase();
    }

    if (!groups[label]) {
      groups[label] = [];
      order.push(label);
    }
    groups[label].push(a);
  }

  return order.map((label) => ({ label, items: groups[label] }));
}
