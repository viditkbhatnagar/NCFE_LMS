'use client';

import { useState } from 'react';
import { FILE_ICONS, getFileExt, formatSize } from './FileCard';
import type { FileItem } from '@/types';

interface FileListViewProps {
  items: FileItem[];
  onItemClick: (item: FileItem) => void;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
}

export default function FileListView({ items, onItemClick, onRename, onDelete }: FileListViewProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleRename = (id: string) => {
    if (onRename && newName.trim()) {
      onRename(id, newName.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="overflow-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uploaded By</th>
            <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
            {(onRename || onDelete) && (
              <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const ext = getFileExt(item.fileName);
            const fileIcon = FILE_ICONS[ext] || { icon: ext.toUpperCase() || 'FILE', color: '#6B7280' };
            const date = new Date(item.createdAt);
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <tr
                key={item._id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onItemClick(item)}
              >
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-3">
                    {item.isFolder ? (
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-amber-50 text-amber-600 shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: fileIcon.color }}
                      >
                        {fileIcon.icon}
                      </div>
                    )}
                    {renamingId === item._id ? (
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(item._id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => handleRename(item._id)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="text-sm font-medium text-gray-900 border border-blue-500 rounded px-1 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900 truncate">{item.fileName}</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-xs text-gray-500">
                  {item.isFolder ? 'Folder' : ext.toUpperCase() || '—'}
                </td>
                <td className="py-2.5 px-4 text-xs text-gray-500">
                  {item.isFolder ? '—' : formatSize(item.fileSize)}
                </td>
                <td className="py-2.5 px-4 text-xs text-gray-500 truncate max-w-[150px]">
                  {item.uploadedBy?.name || '—'}
                </td>
                <td className="py-2.5 px-4 text-xs text-gray-500">{dateStr}</td>
                {(onRename || onDelete) && (
                  <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {onRename && (
                        <button
                          onClick={() => {
                            setRenamingId(item._id);
                            setNewName(item.fileName);
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Rename"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {!item.isFolder && item.fileUrl && (
                        <a
                          href={item.fileUrl}
                          download={item.fileName}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title="Download"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item._id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
