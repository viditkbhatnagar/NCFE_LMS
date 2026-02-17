'use client';

import Modal from '@/components/ui/Modal';

interface Enrollment {
  _id: string;
  userId: { _id: string; name: string; email: string };
  status: string;
  cohortId: string;
}

interface LearnerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollments: Enrollment[];
  onSelect: (enrollment: Enrollment) => void;
}

export default function LearnerSelectionModal({
  isOpen,
  onClose,
  enrollments,
  onSelect,
}: LearnerSelectionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Learner" size="sm">
      <div className="space-y-1">
        {enrollments.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No learners enrolled</p>
        )}
        {enrollments.map((enrollment) => {
          const name = enrollment.userId?.name || 'Unknown';
          const initials = name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <button
              key={enrollment._id}
              onClick={() => onSelect(enrollment)}
              className="w-full flex items-center gap-3 p-3 rounded-[6px] hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-500 truncate">{enrollment.userId?.email || 'No email'}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
