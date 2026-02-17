'use client';

import { type ReactNode, useEffect, useRef, useCallback } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export default function DetailPanel({ isOpen, onClose, children, width = 'w-[420px]' }: Props) {
  const mobileRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeyDown);
    // Focus the mobile overlay on open
    mobileRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const closeButton = (
    <button
      onClick={onClose}
      className="p-1 rounded-[6px] hover:bg-gray-100 transition-colors text-gray-500"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  return (
    <>
      {/* Mobile: full-screen fixed overlay */}
      <div
        ref={mobileRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col"
      >
        <div className="flex justify-end p-2 border-b border-gray-100 shrink-0">
          {closeButton}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* Desktop: inline slide-in panel */}
      <div
        className={`hidden lg:block ${width} bg-white border-l border-gray-200 h-full overflow-y-auto shrink-0`}
      >
        <div className="sticky top-0 bg-white z-10 flex justify-end p-2 border-b border-gray-100">
          {closeButton}
        </div>
        {children}
      </div>
    </>
  );
}
