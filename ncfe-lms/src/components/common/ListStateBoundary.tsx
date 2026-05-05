'use client';

import { ReactNode } from 'react';

type Props = {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  skeleton: ReactNode;
  emptyContent: ReactNode;
  children: ReactNode;
};

export function DefaultListSkeleton({ rows = 4 }: { rows?: number } = {}) {
  return (
    <div className="bg-white rounded-[8px] border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-[8px] border border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-16" />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      data-testid="error-state"
      className="bg-white rounded-[8px] border border-gray-200 p-8 text-center"
    >
      <div className="mx-auto w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <svg
          className="w-5 h-5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-gray-900">Couldn&apos;t load this page</h3>
      <p className="text-xs text-gray-500 mt-1">
        {message || 'Something went wrong while fetching this content.'}
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-50"
      >
        Retry
      </button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  cta?: ReactNode;
}) {
  return (
    <div
      data-testid="empty-state"
      className="bg-white rounded-[8px] border border-gray-200 p-8 text-center"
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
        {icon || (
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

export default function ListStateBoundary({
  loading,
  error,
  isEmpty,
  onRetry,
  skeleton,
  emptyContent,
  children,
}: Props) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (loading) {
    return <>{skeleton}</>;
  }
  if (isEmpty) {
    return <>{emptyContent}</>;
  }
  return <>{children}</>;
}
