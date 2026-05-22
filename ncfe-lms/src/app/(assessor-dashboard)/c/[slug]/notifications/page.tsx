'use client';

import { useEffect, useState, useCallback } from 'react';
import ListStateBoundary, { EmptyState } from '@/components/common/ListStateBoundary';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  assessment_created:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  assessment_published:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  assessment_updated:
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  sign_off_assessor:
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  sign_off_learner:
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  sign_off_iqa:
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  remark_added:
    'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  evidence_uploaded:
    'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  submission_created:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

const FALLBACK_ICON =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

// Navigation is resolved server-side — see /api/notifications/[id]/go.
function notificationGoUrl(id: string): string {
  return `/api/notifications/${id}/go`;
}

function formatFullTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  const fetchNotifications = useCallback(async (pageNum: number) => {
    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/notifications?page=${pageNum}&limit=${limit}`);
      if (!res.ok) {
        if (pageNum === 1) setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) {
        if (pageNum === 1) {
          setNotifications(json.data);
        } else {
          setNotifications((prev) => [...prev, ...json.data]);
        }
        setHasMore(json.data.length === limit);
      } else if (pageNum === 1) {
        setError(json.error || 'Failed to load notifications.');
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      if (pageNum === 1) setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => fetchNotifications(1), [fetchNotifications]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  }

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silently fail
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silently fail
    }
  }

  function handleClick(n: Notification) {
    // Resolver route marks-read + redirects to the correct page.
    window.location.href = notificationGoUrl(n._id);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={notifications.length === 0}
        onRetry={handleRetry}
        skeleton={
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-[8px] border border-gray-200 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
        emptyContent={
          <EmptyState
            title="No notifications yet"
            description="When something happens — a new assessment, a sign-off, evidence uploaded — you'll see it here."
          />
        }
      >
          <div className="space-y-2">
            {notifications.map((n) => {
              return (
                <button
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left bg-white rounded-[8px] border p-4 flex gap-3 hover:shadow-sm transition-all cursor-pointer ${
                    !n.isRead ? 'border-l-4 border-l-primary bg-primary/5 border-gray-200' : 'border-gray-200'
                  }`}
                >
                  {/* Icon */}
                  <div className="shrink-0 mt-0.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!n.isRead ? 'bg-primary/10' : 'bg-gray-100'}`}>
                      <svg
                        className={`w-4 h-4 ${!n.isRead ? 'text-primary' : 'text-gray-400'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d={TYPE_ICONS[n.type] || FALLBACK_ICON}
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {formatFullTimestamp(n.createdAt)}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 self-center">
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-4">
              <button
                onClick={loadMore}
                className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-[6px] transition-colors"
              >
                Load more
              </button>
            </div>
          )}
      </ListStateBoundary>
    </div>
  );
}
