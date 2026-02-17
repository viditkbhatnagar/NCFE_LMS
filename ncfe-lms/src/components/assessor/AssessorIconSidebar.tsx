'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

interface NavIcon {
  label: string;
  path: string;
  icon: React.ReactNode;
  dividerAfter?: boolean;
}

const navIcons: NavIcon[] = [
  {
    label: 'Home',
    path: '',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Assessment',
    path: '/assessments',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Progress',
    path: '/progress',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    label: 'Portfolio',
    path: '/portfolio',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    dividerAfter: true,
  },
  {
    label: 'Course Documents',
    path: '/documents',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Personal Documents',
    path: '/personal-documents',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Materials',
    path: '/materials',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'Work Hours',
    path: '/work-hours',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AssessorIconSidebar({ isOpen, onClose }: Props) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string | undefined;
  const basePath = slug ? `/c/${slug}` : '/c';
  const prevPathnameRef = useRef(pathname);

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname && onClose) {
      onClose();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, onClose]);

  // When no slug (course selector), only show Home icon
  const visibleIcons = slug ? navIcons : navIcons.filter((item) => item.path === '');

  const sidebarContent = (
    <aside className="w-[65px] bg-[#1A1A2E] flex flex-col items-center py-3 gap-1 shrink-0 h-full">
      {visibleIcons.map((item) => {
        const href = `${basePath}${item.path}`;
        const isActive =
          item.path === ''
            ? pathname === basePath || pathname === `${basePath}/`
            : pathname.startsWith(href);

        return (
          <div key={item.label}>
            <Link
              href={href}
              className={`group relative flex items-center justify-center w-[50px] h-[50px] rounded-[8px] transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
              title={item.label}
            >
              {item.icon}
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-[4px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity delay-300 z-[60]">
                {item.label}
              </span>
            </Link>
            {item.dividerAfter && slug && (
              <div className="w-8 h-px bg-gray-600 mx-auto my-2" />
            )}
          </div>
        );
      })}
    </aside>
  );

  return (
    <>
      {/* Desktop: static inline sidebar */}
      <div className="hidden lg:block shrink-0">{sidebarContent}</div>

      {/* Mobile: fixed overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          {/* Sidebar panel */}
          <div className="relative z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
