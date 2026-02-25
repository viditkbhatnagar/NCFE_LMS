'use client';

import FileCard from './FileCard';
import type { FileItem } from '@/types';

interface FileGridProps {
  items: FileItem[];
  onItemClick: (item: FileItem) => void;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
  onPreview?: (item: FileItem) => void;
  onDownload?: (item: FileItem) => void;
}

export default function FileGrid({ items, onItemClick, onRename, onDelete, onPreview, onDownload }: FileGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
      {items.map((item) => (
        <FileCard
          key={item._id}
          item={item}
          onClick={() => onItemClick(item)}
          onRename={onRename}
          onDelete={onDelete}
          onPreview={onPreview}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
