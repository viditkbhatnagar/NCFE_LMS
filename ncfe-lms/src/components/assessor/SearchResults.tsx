'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchResults as SearchResultsType } from '@/types';

type TabId = 'all' | 'members' | 'assessments' | 'evidence';

interface Props {
  results: SearchResultsType;
  query: string;
  isLoading: boolean;
  slug?: string;
  onClose: () => void;
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchResultsDropdown({
  results,
  query,
  isLoading,
  slug,
  onClose,
}: Props) {
  const [tab, setTab] = useState<TabId>('all');
  const router = useRouter();

  const total =
    results.members.length + results.assessments.length + results.evidence.length;

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: total },
    { id: 'members', label: 'Members', count: results.members.length },
    { id: 'assessments', label: 'Assessments', count: results.assessments.length },
    { id: 'evidence', label: 'Evidence', count: results.evidence.length },
  ];

  const basePath = slug ? `/c/${slug}` : '';

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-[8px] shadow-xl z-50 max-h-[480px] flex flex-col">
      {/* Tab row */}
      <div className="flex border-b border-gray-100 px-3 pt-2 gap-1 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-gray-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && total === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Members section */}
        {!isLoading &&
          (tab === 'all' || tab === 'members') &&
          results.members.length > 0 && (
            <div>
              {tab === 'all' && (
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Members
                </p>
              )}
              {results.members.map((m) => (
                <button
                  key={m._id}
                  onClick={() => navigateTo(`${basePath}/members`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium shrink-0">
                    {(m.name || '')
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((n) => n.charAt(0))
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">
                      {highlight(m.name, query)}
                    </p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

        {/* Assessments section */}
        {!isLoading &&
          (tab === 'all' || tab === 'assessments') &&
          results.assessments.length > 0 && (
            <div>
              {tab === 'all' && (
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Assessments
                </p>
              )}
              {results.assessments.map((a) => (
                <button
                  key={a._id}
                  onClick={() => navigateTo(`${basePath}/assessment`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-brand-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">
                      {highlight(a.title || 'Untitled', query)}
                    </p>
                    <p className="text-xs text-gray-400">{a.learnerName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

        {/* Evidence section */}
        {!isLoading &&
          (tab === 'all' || tab === 'evidence') &&
          results.evidence.length > 0 && (
            <div>
              {tab === 'all' && (
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Evidence
                </p>
              )}
              {results.evidence.map((ev) => (
                <button
                  key={ev._id}
                  onClick={() => navigateTo(`${basePath}/portfolio`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">
                      {highlight(ev.fileName, query)}
                    </p>
                    <p className="text-xs text-gray-400">{ev.learnerName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
