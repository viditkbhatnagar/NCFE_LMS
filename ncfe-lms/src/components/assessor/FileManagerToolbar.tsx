'use client';

type ViewMode = 'grid' | 'list';

interface FileManagerToolbarProps {
  fileTypeFilter: string;
  onFileTypeChange: (v: string) => void;
  categoryFilter?: string;
  onCategoryChange?: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onUpload?: () => void;
  onNewFolder?: () => void;
}

export default function FileManagerToolbar({
  fileTypeFilter,
  onFileTypeChange,
  categoryFilter,
  onCategoryChange,
  viewMode,
  onViewModeChange,
  onUpload,
  onNewFolder,
}: FileManagerToolbarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm text-gray-400">Select a file to see actions</span>

      <div className="flex-1" />

      {/* File type filter */}
      <select
        value={fileTypeFilter}
        onChange={(e) => onFileTypeChange(e.target.value)}
        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <option value="">All Files</option>
        <option value="pdf">PDF</option>
        <option value="doc">Word</option>
        <option value="image">Image</option>
        <option value="video">Video</option>
      </select>

      {/* Category filter (materials only) */}
      {onCategoryChange && (
        <select
          value={categoryFilter || ''}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">All Categories</option>
          <option value="manual">Manual</option>
          <option value="slides">Slides</option>
          <option value="video">Video</option>
          <option value="guidance">Guidance</option>
          <option value="template">Template</option>
        </select>
      )}

      {/* Upload button */}
      {onUpload && (
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Files
        </button>
      )}

      {/* New folder button */}
      {onNewFolder && (
        <button
          onClick={onNewFolder}
          className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>
      )}

      {/* Grid / List toggle */}
      <div className="flex border border-gray-200 rounded-md overflow-hidden">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`px-2.5 py-1.5 transition-colors ${
            viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'
          }`}
          title="Grid view"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 ${
            viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'
          }`}
          title="List view"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
