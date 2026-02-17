'use client';

interface ProgressColumnProps {
  title: string;
  itemCount?: number;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export default function ProgressColumn({
  title,
  itemCount,
  children,
  isEmpty = false,
  emptyMessage = 'Select an item',
}: ProgressColumnProps) {
  return (
    <div className="flex flex-col min-w-[220px] flex-1 border-r border-gray-100 last:border-r-0 h-full overflow-hidden">
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/80 shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
        {itemCount !== undefined && (
          <span className="text-[10px] text-gray-400">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
        )}
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 py-8">
            <svg
              className="w-8 h-8 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <p className="text-xs text-center">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
