'use client';

import type { TeamMember } from '@/types';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  assessor: { label: 'Assessor', className: 'bg-brand-100 text-brand-700' },
  iqa: { label: 'IQA', className: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', className: 'bg-orange-100 text-orange-700' },
  student: { label: 'Learner', className: 'bg-green-100 text-green-700' },
};

interface Props {
  member: TeamMember;
}

export default function MemberCard({ member }: Props) {
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const badge = ROLE_BADGE[member.role] ?? {
    label: member.role,
    className: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 rounded-[6px] transition-colors">
      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
        <p className="text-xs text-gray-400 truncate">{member.email}</p>
      </div>
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${badge.className}`}
      >
        {badge.label}
      </span>
    </div>
  );
}
