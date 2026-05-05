'use client';

import { useState } from 'react';
import Link from 'next/link';

const COOKIE_NAME = 'cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
}

export default function CookieConsentBanner() {
  // Initial state checks the cookie synchronously (only on the client; document
  // is undefined during SSR so readCookie returns null and the banner stays
  // hidden until hydration). Keeps the synchronous setVisible(true) out of an
  // effect (which ESLint flags as a cascading-render anti-pattern).
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return readCookie(COOKIE_NAME) === null;
  });

  if (!visible) return null;

  const decide = (value: 'all' | 'essential') => {
    writeCookie(COOKIE_NAME, value);
    setVisible(false);
  };

  return (
    <div
      data-testid="cookie-consent-banner"
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-[8px] border border-gray-200 bg-white shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 text-sm text-gray-700">
          We use essential cookies for sign-in and session management. With your consent we may also use non-essential cookies for analytics. See our{' '}
          <Link href="/privacy" className="underline text-primary">
            privacy policy
          </Link>
          .
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => decide('essential')}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
          >
            Reject non-essential
          </button>
          <button
            onClick={() => decide('all')}
            className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
