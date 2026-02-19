'use client';

import { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useAssessorCourseOptional } from '@/contexts/AssessorCourseContext';
import SearchResultsDropdown from './SearchResults';
import type { SearchResults, UserRole } from '@/types';

interface Props {
  userName: string;
  userRole?: UserRole;
  onMenuToggle?: () => void;
}

export default function AssessorTopNav({ userName, userRole = 'assessor', onMenuToggle }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    members: [],
    assessments: [],
    evidence: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get qualification context (null outside /c/[slug])
  const course = useAssessorCourseOptional();
  const qualificationId = course?.qualification._id;
  const slug = course?.qualification.slug;

  const initials = (userName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (value.trim().length < 2) {
      setSearchOpen(false);
      return;
    }

    setSearchOpen(true);
    setIsSearching(true);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: value });
        if (qualificationId) params.set('qualificationId', qualificationId);
        const res = await fetch(`/api/v2/search?${params}`);
        const json = await res.json();
        if (json.success) setSearchResults(json.data);
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-14 flex items-center px-4">
      {/* Mobile hamburger */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 mr-2 rounded-[6px] hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Logos */}
      <div className="flex items-center gap-3 mr-4">
        <img src="/skillhub-logo.jpeg" alt="Skill Hub" className="h-8 w-auto object-contain" />
        <div className="hidden sm:block h-6 w-px bg-gray-200" />
        <img src="/ncfe-logo.jpg" alt="NCFE" className="hidden sm:block h-6 w-auto object-contain" />
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-2xl mx-auto" ref={searchContainerRef}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchQuery.trim().length >= 2 && setSearchOpen(true)}
            placeholder="Search courses, members, assessments..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-[8px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {searchOpen && (
            <SearchResultsDropdown
              results={searchResults}
              query={searchQuery}
              isLoading={isSearching}
              slug={slug}
              onClose={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
            />
          )}
        </div>
      </div>

      {/* User Avatar Dropdown */}
      <div className="relative ml-4" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1 rounded-[6px] hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
            {initials}
          </div>
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[8px] shadow-lg border border-gray-200 py-3 z-50">
            <div className="px-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Hi, {userName}!</p>
                  <p className="text-xs text-gray-500">{userRole === 'student' ? 'Learner' : 'Assessor'}</p>
                </div>
              </div>
            </div>
            <div className="px-4 pt-3">
              <button
                onClick={() => signOut({ callbackUrl: '/sign-in' })}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-[6px] transition-colors"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
