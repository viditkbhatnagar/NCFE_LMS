'use client';

import { useState } from 'react';
import type { SignOffEntry, SignOffRole } from '@/types';

interface SignOffStatusSectionProps {
  signOffs: SignOffEntry[];
  assessmentId: string;
  onSignOff: () => void;
}

const ROLE_ORDER: SignOffRole[] = ['assessor', 'iqa', 'eqa', 'learner'];

const ROLE_CONFIG: Record<SignOffRole, { label: string; icon: React.ReactNode }> = {
  assessor: {
    label: 'Assessor',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  iqa: {
    label: 'Internal Quality Assurer',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  eqa: {
    label: 'External Quality Assurer',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  learner: {
    label: 'Learner',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
};

export default function SignOffStatusSection({
  signOffs,
  assessmentId,
  onSignOff,
}: SignOffStatusSectionProps) {
  const [signingOff, setSigningOff] = useState(false);

  const signOffMap: Record<string, SignOffEntry> = {};
  for (const so of signOffs) {
    signOffMap[so.role] = so;
  }

  const completedCount = ROLE_ORDER.filter(
    (role) => signOffMap[role]?.status === 'signed_off'
  ).length;

  // Find next role in sequence
  const nextRole = ROLE_ORDER.find(
    (role) => signOffMap[role]?.status !== 'signed_off'
  );

  const [signOffError, setSignOffError] = useState<string | null>(null);

  const handleSignOff = async () => {
    setSigningOff(true);
    setSignOffError(null);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/sign-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole, status: 'signed_off' }),
      });
      if (res.ok) {
        onSignOff();
      } else {
        const json = await res.json().catch(() => null);
        const msg = json?.error || `Sign-off failed (HTTP ${res.status})`;
        setSignOffError(msg);
        console.error('Sign-off error:', msg);
      }
    } catch (err) {
      console.error('Error signing off:', err);
      setSignOffError('Network error');
    } finally {
      setSigningOff(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Sign-off Status
        </h3>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            {completedCount}/4 Complete
          </span>
          {nextRole && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Next: {ROLE_CONFIG[nextRole].label}
            </span>
          )}
        </div>
      </div>

      {signOffError && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{signOffError}</p>
      )}

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      {/* Role cards with connecting line */}
      <div className="relative ml-4">
        {/* Vertical line */}
        <div className="absolute left-[14px] top-4 bottom-4 w-0.5 bg-gray-200" />

        <div className="space-y-3">
          {ROLE_ORDER.map((role, index) => {
            const so = signOffMap[role];
            const isSigned = so?.status === 'signed_off';
            const isRejected = so?.status === 'rejected';
            const isNext = role === nextRole;
            const canSign = role === 'assessor' && isNext;

            return (
              <div key={role} className="relative flex items-start gap-3">
                {/* Number circle */}
                <div
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSigned
                      ? 'bg-green-500 text-white'
                      : isRejected
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isSigned ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={isSigned ? 'text-green-600' : 'text-gray-400'}>
                      {ROLE_CONFIG[role].icon}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {ROLE_CONFIG[role].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isSigned
                      ? `Signed off${so.signedOffAt ? ` on ${new Date(so.signedOffAt).toLocaleDateString('en-GB')}` : ''}`
                      : isRejected
                      ? 'Rejected'
                      : isNext
                      ? 'Awaiting sign off'
                      : 'Pending'}
                  </p>
                </div>

                {/* Action */}
                {canSign && !isSigned && (
                  <button
                    onClick={handleSignOff}
                    disabled={signingOff}
                    className="px-3 py-1 bg-gray-900 text-white rounded-[6px] text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {signingOff ? 'Signing...' : 'Sign Off'}
                  </button>
                )}
                {!canSign && !isSigned && !isRejected && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pending
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
