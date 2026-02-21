'use client';

import { useState } from 'react';
import type { FileItem } from '@/types';

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'PDF', color: '#DC2626' },
  doc: { icon: 'DOC', color: '#2563EB' },
  docx: { icon: 'DOC', color: '#2563EB' },
  jpg: { icon: 'IMG', color: '#059669' },
  jpeg: { icon: 'IMG', color: '#059669' },
  png: { icon: 'IMG', color: '#059669' },
  mp4: { icon: 'VID', color: '#7C3AED' },
  pptx: { icon: 'PPT', color: '#D97706' },
};

function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileCardProps {
  item: FileItem;
  onClick: () => void;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
}

export default function FileCard({ item, onClick, onRename, onDelete }: FileCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(item.fileName);

  const ext = getFileExt(item.fileName);
  const fileIcon = FILE_ICONS[ext] || { icon: ext.toUpperCase() || 'FILE', color: '#6B7280' };

  const date = new Date(item.createdAt);
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleRename = () => {
    if (onRename && newName.trim() && newName !== item.fileName) {
      onRename(item._id, newName.trim());
    }
    setRenaming(false);
    setShowMenu(false);
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer relative group"
      onClick={() => {
        if (!renaming) onClick();
      }}
    >
      {/* Context menu button */}
      {(onRename || onDelete) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all text-gray-400"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      )}

      {/* Context menu dropdown */}
      {showMenu && (
        <div
          className="absolute top-8 right-2 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button
              onClick={() => {
                setRenaming(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Rename
            </button>
          )}
          {!item.isFolder && item.fileUrl && (
            <a
              href={item.fileUrl}
              download={item.fileName}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Download
            </a>
          )}
          {onDelete && (
            <button
              onClick={() => {
                onDelete(item._id);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Icon */}
      {item.isFolder ? (
        <div className="w-10 h-10 rounded-md flex items-center justify-center mb-3 bg-amber-50 text-amber-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center mb-3 text-xs font-bold text-white overflow-hidden"
          style={{ backgroundColor: fileIcon.color }}
        >
          {fileIcon.icon}
        </div>
      )}

      {/* Name */}
      {renaming ? (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setRenaming(false);
                setNewName(item.fileName);
              }
            }}
            onBlur={handleRename}
            autoFocus
            className="w-full text-sm font-semibold text-gray-900 border border-brand-500 rounded px-1 py-0.5 focus:outline-none"
          />
        </div>
      ) : (
        <p className="text-sm font-semibold text-gray-900 truncate mb-0.5" title={item.fileName}>
          {item.fileName}
        </p>
      )}

      {/* Meta */}
      {item.isFolder ? (
        <p className="text-xs text-gray-400">Folder</p>
      ) : (
        <div className="text-xs text-gray-400 mt-1 space-y-0.5">
          <p>{formatSize(item.fileSize)}</p>
          <p>{dateStr}</p>
          {item.uploadedBy?.name && <p className="truncate">{item.uploadedBy.name}</p>}
        </div>
      )}
    </div>
  );
}

export { FILE_ICONS, getFileExt, formatSize };
