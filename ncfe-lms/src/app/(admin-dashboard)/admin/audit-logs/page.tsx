'use client';

import { useState, useEffect, useCallback } from 'react';

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

const entityTypes = ['All', 'User', 'Qualification', 'Unit', 'LearningOutcome', 'AssessmentCriteria', 'Enrolment'];

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [entityTypeFilter, setEntityTypeFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pagination.page), limit: '50' });
    if (entityTypeFilter !== 'All') params.set('entityType', entityTypeFilter);
    if (actionFilter) params.set('action', actionFilter);

    try {
      const res = await fetch(`/api/v2/admin/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, entityTypeFilter, actionFilter]);

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
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={entityTypeFilter}
          onChange={(e) => { setEntityTypeFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
          className="px-4 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No audit logs found.</div>
        ) : (
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
        )}

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
    </div>
  );
}
