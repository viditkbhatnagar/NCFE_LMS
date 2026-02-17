'use client';

import FileCard from './FileCard';
import type { FileItem } from '@/types';

interface FileGridProps {
  items: FileItem[];
  onItemClick: (item: FileItem) => void;
  onRename?: (id: string, newName: string) => void;
  onDelete?: (id: string) => void;
}

export default function FileGrid({ items, onItemClick, onRename, onDelete }: FileGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
      {items.map((item) => (
        <FileCard
          key={item._id}
          item={item}
          onClick={() => onItemClick(item)}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
