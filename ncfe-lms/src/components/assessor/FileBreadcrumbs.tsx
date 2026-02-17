'use client';

import type { FolderBreadcrumb } from '@/types';

interface FileBreadcrumbsProps {
  path: FolderBreadcrumb[];
  onNavigate: (folderId: string | null) => void;
  rootLabel?: string;
}

export default function FileBreadcrumbs({
  path,
  onNavigate,
  rootLabel = 'All Files',
}: FileBreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-4">
      <button
        onClick={() => onNavigate(null)}
        className={`hover:text-blue-600 transition-colors ${
          path.length === 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
        }`}
      >
        {rootLabel}
      </button>
      {path.map((crumb, i) => (
        <span key={crumb._id || 'root'} className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => onNavigate(crumb._id)}
            className={`hover:text-blue-600 transition-colors ${
              i === path.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            {crumb.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
