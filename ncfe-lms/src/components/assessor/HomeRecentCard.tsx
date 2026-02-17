'use client';

import Link from 'next/link';

export interface RecentCardItem {
  _id: string;
  primaryText: string;
  secondaryText: string;
  metaText: string;
  badge?: string;
  badgeClass?: string;
}

interface Props {
  title: string;
  icon: React.ReactNode;
  items: RecentCardItem[];
  linkHref: string;
  linkLabel: string;
  emptyText?: string;
}

export default function HomeRecentCard({
  title,
  icon,
  items,
  linkHref,
  linkLabel,
  emptyText = 'No recent items',
}: Props) {
  return (
    <div className="bg-white rounded-[8px] border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <Link
          href={linkHref}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          {linkLabel}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      <div className="flex-1 divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">{emptyText}</p>
        )}
        {items.map((item) => (
          <div
            key={item._id}
            className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {item.primaryText}
              </p>
              <p className="text-xs text-gray-400 truncate">{item.secondaryText}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    item.badgeClass ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {item.metaText}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
