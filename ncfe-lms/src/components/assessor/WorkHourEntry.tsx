'use client';

import type { WorkHourEntryItem } from '@/types';

interface WorkHourEntryProps {
  entry: WorkHourEntryItem;
  onEdit: (entry: WorkHourEntryItem) => void;
  onDelete: (id: string) => void;
}

function getInitials(name: string): string {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#EC4899'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function WorkHourEntry({ entry, onEdit, onDelete }: WorkHourEntryProps) {
  const learnerName = entry.learnerId?.name || 'Unknown';

  return (
    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 group">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: getAvatarColor(learnerName) }}
      >
        {getInitials(learnerName)}
      </div>

      {/* Name + notes */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{learnerName}</p>
        {entry.notes && (
          <p className="text-xs text-gray-500 truncate">{entry.notes}</p>
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-1 text-sm font-medium text-gray-700 shrink-0">
        <span>{entry.hours}<span className="text-gray-400 text-xs ml-0.5">h</span></span>
        <span>{entry.minutes}<span className="text-gray-400 text-xs ml-0.5">m</span></span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onEdit(entry)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(entry._id)}
          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
