'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

interface LiveSession {
  _id: string;
  title: string;
  description: string;
  cohortId: string;
  meetingLink: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  recordingUrl?: string;
  recordingLink?: string;
  qualification?: { title: string; slug: string; code: string } | null;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudentLiveClassesPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/live-sessions');
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setSessions(json.data);
      else setError(json.error || 'Failed to load live classes.');
    } catch {
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const now = Date.now();
  const upcoming = sessions.filter(
    (s) => s.status !== 'cancelled' && new Date(s.scheduledAt).getTime() >= now,
  );
  const past = sessions.filter(
    (s) => s.status === 'cancelled' || new Date(s.scheduledAt).getTime() < now,
  );

  const renderCard = (s: LiveSession) => {
    const isPast =
      s.status === 'cancelled' || new Date(s.scheduledAt).getTime() < now;
    return (
      <div key={s._id} className="bg-white rounded-[8px] border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{s.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {s.qualification?.title ?? '—'} · {fmtDateTime(s.scheduledAt)} · {s.durationMinutes} min
            </p>
            {s.description && (
              <p className="text-xs text-gray-600 mt-1.5">{s.description}</p>
            )}
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              s.status === 'cancelled'
                ? 'bg-red-50 text-red-600'
                : isPast
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-green-50 text-green-700'
            }`}
          >
            {s.status === 'cancelled' ? 'Cancelled' : isPast ? 'Past' : 'Upcoming'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {!isPast && s.status !== 'cancelled' && (
            <a
              href={s.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
            >
              Join class
            </a>
          )}
          {(s.recordingLink || s.recordingUrl) && (
            <a
              href={s.recordingLink || `/api/v2/live-sessions/${s._id}/recording/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Watch recording
            </a>
          )}
          {s.qualification?.slug && (
            <Link
              href={`/c/${s.qualification.slug}/live-sessions`}
              className="ml-auto text-xs text-primary hover:underline"
            >
              Open in course →
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Classes</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Scheduled live sessions and recordings across every course you&apos;re enrolled in
        </p>
      </div>

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={sessions.length === 0}
        onRetry={fetchSessions}
        skeleton={<DefaultListSkeleton rows={3} />}
        emptyContent={
          <EmptyState
            title="No live classes scheduled"
            description="When your assessor schedules a live class for any of your courses, it'll show up here with a Join link and (after the class) the recording."
          />
        }
      >
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-3">{upcoming.map(renderCard)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Past ({past.length})
              </h2>
              <div className="space-y-3">{past.map(renderCard)}</div>
            </div>
          )}
        </div>
      </ListStateBoundary>
    </div>
  );
}
