'use client';

import type { SignOffEntry, AssessmentStatus } from '@/types';

interface DetailHeaderProps {
  date: string;
  title: string;
  signOffs: SignOffEntry[];
  saveStatus: 'saved' | 'saving' | 'unsaved';
  status: AssessmentStatus;
  readOnly?: boolean;
  onDateChange: (date: string) => void;
  onTitleChange: (title: string) => void;
  onPublish: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ROLE_ICONS: Record<string, { label: string; icon: React.ReactNode }> = {
  assessor: {
    label: 'Assessor',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  iqa: {
    label: 'IQA',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  eqa: {
    label: 'EQA',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  learner: {
    label: 'Learner',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
};

export default function DetailHeader({
  date,
  title,
  signOffs,
  saveStatus,
  status,
  readOnly = false,
  onDateChange,
  onTitleChange,
  onPublish,
  onDelete,
  onClose,
}: DetailHeaderProps) {
  const d = date ? new Date(date) : null;
  const dateValue = d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';

  return (
    <div className="sticky top-0 bg-white z-10 border-b border-gray-200 px-4 py-3 space-y-3">
      {/* Row 1: Close + Date + Title */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          className="p-1 rounded-[6px] hover:bg-gray-100 transition-colors text-gray-500 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className={`flex items-center gap-1 bg-gray-100 rounded-[6px] px-2 py-1 shrink-0 ${readOnly ? 'opacity-60' : ''}`}>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={readOnly}
            className="bg-transparent text-xs text-gray-700 border-none outline-none w-[100px]"
          />
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={readOnly ? '' : 'Assessment title...'}
          readOnly={readOnly}
          className={`flex-1 border-none outline-none text-sm font-semibold text-gray-900 placeholder:text-gray-400 bg-transparent ${readOnly ? 'cursor-default' : ''}`}
        />
      </div>

      {/* Row 2: Sign-off icons + Save status + Status button + Delete */}
      <div className="flex items-center gap-2">
        {/* Sign-off icons */}
        <div className="flex items-center gap-1">
          {['assessor', 'iqa', 'eqa', 'learner'].map((role) => {
            const so = signOffs.find((s) => s.role === role);
            const isSigned = so?.status === 'signed_off';
            const isRejected = so?.status === 'rejected';
            const roleInfo = ROLE_ICONS[role];

            return (
              <div
                key={role}
                title={`${roleInfo.label} - ${so?.status || 'pending'}`}
                className={`p-1 rounded-full ${
                  isSigned
                    ? 'text-green-600 bg-green-50'
                    : isRejected
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-400 bg-gray-50'
                }`}
              >
                {roleInfo.icon}
              </div>
            );
          })}
        </div>

        {/* Save status — hidden for read-only */}
        {!readOnly && (
          <span
            className={`text-xs ${
              saveStatus === 'saved'
                ? 'text-green-600'
                : saveStatus === 'saving'
                ? 'text-yellow-600'
                : 'text-gray-400'
            }`}
          >
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
        )}

        <div className="flex-1" />

        {/* Status button */}
        {!readOnly && status === 'draft' ? (
          <button
            onClick={onPublish}
            className="px-3 py-1 bg-primary text-white rounded-[6px] text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Send to learner
          </button>
        ) : status === 'published' ? (
          <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-[6px] text-xs font-medium">
            Published
          </span>
        ) : null}

        {/* Delete — hidden for read-only */}
        {!readOnly && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-[6px] hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete assessment"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
