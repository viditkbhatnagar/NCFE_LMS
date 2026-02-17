'use client';

import type { EvidenceStatus } from '@/types';

type ViewMode = 'grid' | 'list';
type SortOrder = 'newest' | 'oldest';

interface PortfolioToolbarProps {
  status: EvidenceStatus | '';
  onStatusChange: (v: EvidenceStatus | '') => void;
  fileType: string;
  onFileTypeChange: (v: string) => void;
  sort: SortOrder;
  onSortChange: (v: SortOrder) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onUploadClick: () => void;
}

export default function PortfolioToolbar({
  status,
  onStatusChange,
  fileType,
  onFileTypeChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  onUploadClick,
}: PortfolioToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Upload button */}
      <button
        onClick={onUploadClick}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Upload Evidence
      </button>

      <div className="flex-1" />

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as EvidenceStatus | '')}
        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="submitted">Submitted</option>
        <option value="assessed">Assessed</option>
      </select>

      {/* File type filter */}
      <select
        value={fileType}
        onChange={(e) => onFileTypeChange(e.target.value)}
        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">All Types</option>
        <option value="pdf">PDF</option>
        <option value="doc">Word</option>
        <option value="image">Image</option>
        <option value="video">Video</option>
      </select>

      {/* Sort toggle */}
      <button
        onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
        className="flex items-center gap-1.5 border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        title="Toggle sort order"
      >
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
          />
        </svg>
        {sort === 'newest' ? 'Newest' : 'Oldest'}
      </button>

      {/* Grid / List toggle */}
      <div className="flex border border-gray-200 rounded-md overflow-hidden">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`px-2.5 py-1.5 transition-colors ${
            viewMode === 'grid'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-400 hover:text-gray-700'
          }`}
          title="Grid view"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 ${
            viewMode === 'list'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-400 hover:text-gray-700'
          }`}
          title="List view"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
