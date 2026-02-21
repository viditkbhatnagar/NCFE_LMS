'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import NotificationBell from '@/components/shared/NotificationBell';

interface TopBarProps {
  userName: string;
}

export default function TopBar({ userName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Breadcrumb area */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-text-muted md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationBell />

          {/* Messages */}
          <Link
            href="/messages"
            className="relative p-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-medium text-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
