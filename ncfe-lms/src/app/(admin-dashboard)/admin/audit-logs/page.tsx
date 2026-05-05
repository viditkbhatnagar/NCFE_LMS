'use client';

import { useState, useEffect, useCallback } from 'react';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

interface AuditLog {
  _id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

const entityTypes = ['All', 'User', 'Qualification', 'Unit', 'LearningOutcome', 'AssessmentCriteria', 'Enrolment', 'Assessment', 'Evidence', 'IQADecision', 'IQASample', 'AuditLog'];

interface UserOption {
  _id: string;
  name: string;
  email: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [entityTypeFilter, setEntityTypeFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Search-as-you-type for user filter
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) {
      setUserOptions([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v2/admin/users?search=${encodeURIComponent(userSearch)}&limit=8`);
        const data = await res.json();
        if (active && data.success) setUserOptions(data.data as UserOption[]);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [userSearch]);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams({ page: String(pagination.page), limit: '50' });
    if (entityTypeFilter !== 'All') params.set('entityType', entityTypeFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (userIdFilter) params.set('userId', userIdFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    if (sortDir === 'asc') params.set('sort', 'asc');
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
    return params;
  }, [pagination.page, entityTypeFilter, actionFilter, userIdFilter, fromDate, toDate, sortDir]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/admin/audit-logs?${buildParams()}`);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      } else {
        setError(data.error || 'Failed to load audit logs.');
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildParams({ export: 'csv' });
      const res = await fetch(`/api/v2/admin/audit-logs?${params}`);
      if (!res.ok) {
        alert(`Export failed (HTTP ${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-400 mt-0.5">View system activity and change history</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Entity type</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {entityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action contains</label>
            <input
              type="text"
              placeholder="USER_CREATED, EMAIL_SENT…"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50 w-56"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button
              type="button"
              onClick={() => { setSortDir((d) => d === 'desc' ? 'asc' : 'desc'); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 text-xs border border-gray-300 rounded-[6px] hover:bg-gray-50"
              title="Toggle sort direction"
            >
              {sortDir === 'desc' ? '↓ Newest first' : '↑ Oldest first'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-2 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
              title="Export the current filtered view as CSV"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Filter by user</label>
            <input
              type="text"
              placeholder="Type a name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50 w-72"
            />
            {userOptions.length > 0 && !userIdFilter && (
              <div className="absolute z-10 mt-1 w-72 max-h-60 overflow-auto bg-white border border-gray-200 rounded-[6px] shadow">
                {userOptions.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => { setUserIdFilter(u._id); setUserSearch(u.name); setUserOptions([]); setPagination((p) => ({ ...p, page: 1 })); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-gray-500">{u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {userIdFilter && (
            <button
              type="button"
              onClick={() => { setUserIdFilter(''); setUserSearch(''); setPagination((p) => ({ ...p, page: 1 })); }}
              className="text-xs text-primary hover:underline mt-5"
            >
              Clear user filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={logs.length === 0}
        onRetry={fetchLogs}
        skeleton={<DefaultListSkeleton rows={6} />}
        emptyContent={
          <EmptyState
            title="No audit logs found"
            description={
              entityTypeFilter !== 'All' || actionFilter || userIdFilter || fromDate || toDate
                ? 'Try clearing some filters to see more results.'
                : 'Audit entries appear here as users, courses, and assessments are created and changed.'
            }
          />
        }
      >
        <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Entity Type</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{log.action}</td>
                    <td className="px-5 py-3 text-gray-600">{log.entityType}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">{log.entityId?.slice(-8) || '-'}</td>
                    <td className="px-5 py-3">
                      {(log.oldValue || log.newValue) ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {expandedId === log._id ? 'Hide' : 'View'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {/* Expanded detail - rendered below table */}
        {expandedId && (() => {
          const log = logs.find((l) => l._id === expandedId);
          if (!log) return null;
          return (
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {log.oldValue && (
                  <div>
                    <p className="font-medium text-gray-500 mb-1">Old Value:</p>
                    <pre className="bg-white rounded p-2 overflow-x-auto border border-gray-200 text-gray-700">
                      {JSON.stringify(log.oldValue, null, 2)}
                    </pre>
                  </div>
                )}
                {log.newValue && (
                  <div>
                    <p className="font-medium text-gray-500 mb-1">New Value:</p>
                    <pre className="bg-white rounded p-2 overflow-x-auto border border-gray-200 text-gray-700">
                      {JSON.stringify(log.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-xs border border-gray-300 rounded-[6px] disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-xs border border-gray-300 rounded-[6px] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
      </ListStateBoundary>
    </div>
  );
}
