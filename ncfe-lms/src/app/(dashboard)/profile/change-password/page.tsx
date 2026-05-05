'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { generatePassword } from '@/lib/password-generator';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerate = () => {
    setNewPassword(generatePassword());
    setConfirmPassword('');
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard failed', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must differ from the current one.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v2/users/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not change password. Try again.');
        setSubmitting(false);
        return;
      }
      // Force a fresh sign-in so the JWT picks up mustChangePassword=false.
      await signOut({ redirect: false });
      router.push('/sign-in?passwordChanged=1');
    } catch (err) {
      console.error(err);
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 max-w-md w-full p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-900">Change your password</h1>
          <p className="text-sm text-gray-600 mt-1">
            For security, your administrator-issued password must be changed before you can continue. Pick a new password (or click <strong>Generate</strong>) and confirm it below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cp-current">Current password</label>
            <div className="flex items-stretch gap-1">
              <input
                id="cp-current"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                aria-label="Current password"
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                aria-label="Toggle current password visibility"
                title={showCurrent ? 'Hide' : 'Show'}
              >
                {showCurrent ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cp-new">New password</label>
            <div className="flex items-stretch gap-1">
              <input
                id="cp-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setCopied(false); }}
                aria-label="New password"
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={handleGenerate}
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                aria-label="Generate password"
                title="Generate secure password"
              >
                ↻
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                aria-label="Copy password"
                title={copied ? 'Copied' : 'Copy'}
              >
                {copied ? '✓' : '⎘'}
              </button>
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                aria-label="Toggle new password visibility"
                title={showNew ? 'Hide' : 'Show'}
              >
                {showNew ? '🙈' : '👁'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">At least 8 characters. Click Generate for a secure random password.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="cp-confirm">Confirm new password</label>
            <input
              id="cp-confirm"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-label="Confirm new password"
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              minLength={8}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Updating…' : 'Update password and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
