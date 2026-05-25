'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

type StatusChip = 'all' | 'active' | 'completed' | 'withdrawn';

interface Enrolment {
  _id: string;
  userId: { _id: string; name: string; email: string } | null;
  qualificationId: { _id: string; title: string; code: string } | null;
  assessorId: { _id: string; name: string; email: string } | null;
  cohortId: string;
  status: string;
  enrolledAt: string;
}

interface SelectOption {
  _id: string;
  name?: string;
  email?: string;
  title?: string;
  code?: string;
}

export default function AdminEnrolmentsPage() {
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [statusChip, setStatusChip] = useState<StatusChip>('all');

  // G17 — bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | 'withdraw'>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<null | { kind: 'withdraw' | 'export'; updated?: number }>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ userId: '', qualificationId: '', assessorId: '', cohortId: '', status: 'enrolled' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Select options
  const [students, setStudents] = useState<SelectOption[]>([]);
  const [assessors, setAssessors] = useState<SelectOption[]>([]);
  const [qualifications, setQualifications] = useState<SelectOption[]>([]);

  // Withdraw (soft) + permanent delete (hard, with cascade)
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState<{ id: string; label: string } | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  const fetchEnrolments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '20' });
      if (statusChip !== 'all') params.set('statusChip', statusChip);
      const res = await fetch(`/api/v2/admin/enrolments?${params}`);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEnrolments(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      } else {
        setError(data.error || 'Failed to load enrolments.');
      }
    } catch (err) {
      console.error('Failed to fetch enrolments:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusChip]);

  // Reset selection when filters change.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusChip, pagination.page]);

  // Client-side filter (in case the server doesn't yet recognise statusChip)
  const filteredEnrolments = useMemo(() => {
    if (statusChip === 'all') return enrolments;
    if (statusChip === 'active') return enrolments.filter((e) => e.status === 'enrolled' || e.status === 'in_progress');
    return enrolments.filter((e) => e.status === statusChip);
  }, [enrolments, statusChip]);

  const allOnPageSelected = useMemo(
    () => filteredEnrolments.length > 0 && filteredEnrolments.every((e) => selectedIds.has(e._id)),
    [filteredEnrolments, selectedIds],
  );
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        filteredEnrolments.forEach((e) => next.delete(e._id));
      } else {
        filteredEnrolments.forEach((e) => next.add(e._id));
      }
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const runBulkWithdraw = async () => {
    setBulkRunning(true);
    try {
      const res = await fetch('/api/v2/admin/enrolments/bulk-withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkResult({ kind: 'withdraw', updated: data.data?.updated ?? 0 });
        clearSelection();
        fetchEnrolments();
      }
    } finally {
      setBulkRunning(false);
      setBulkAction(null);
    }
  };
  const runBulkExport = async () => {
    setBulkRunning(true);
    try {
      const res = await fetch('/api/v2/admin/enrolments/bulk-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enrolments-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setBulkResult({ kind: 'export' });
      }
    } finally {
      setBulkRunning(false);
    }
  };

  const fetchOptions = useCallback(async () => {
    const [studRes, assRes, qualRes] = await Promise.all([
      fetch('/api/v2/admin/users?role=student&limit=100'),
      fetch('/api/v2/admin/users?role=assessor&limit=100'),
      fetch('/api/v2/admin/qualifications?limit=100'),
    ]);
    const [studData, assData, qualData] = await Promise.all([studRes.json(), assRes.json(), qualRes.json()]);
    if (studData.success) setStudents(studData.data);
    if (assData.success) setAssessors(assData.data);
    if (qualData.success) setQualifications(qualData.data);
  }, []);

  useEffect(() => {
    fetchEnrolments();
  }, [fetchEnrolments]);

  useEffect(() => {
    if (showForm) fetchOptions();
  }, [showForm, fetchOptions]);

  const resetForm = () => {
    setForm({ userId: '', qualificationId: '', assessorId: '', cohortId: '', status: 'enrolled' });
    setEditingId(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (e: Enrolment) => {
    setForm({
      userId: e.userId?._id || '',
      qualificationId: e.qualificationId?._id || '',
      assessorId: e.assessorId?._id || '',
      cohortId: e.cohortId || '',
      status: e.status,
    });
    setEditingId(e._id);
    setShowForm(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    setErrors({});

    const url = editingId ? `/api/v2/admin/enrolments/${editingId}` : '/api/v2/admin/enrolments';
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId
      ? { assessorId: form.assessorId || undefined, cohortId: form.cohortId || undefined, status: form.status }
      : form;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchEnrolments();
      } else if (data.errors) {
        setErrors(data.errors);
      } else if (data.error) {
        setErrors({ _form: [data.error] });
      }
    } catch {
      setErrors({ _form: ['An unexpected error occurred'] });
    } finally {
      setSaving(false);
    }
  };

  const handleHardDelete = async () => {
    if (!confirmHardDelete) return;
    setHardDeleting(true);
    try {
      const res = await fetch(`/api/v2/admin/enrolments/${confirmHardDelete.id}?hard=true`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfirmHardDelete(null);
        fetchEnrolments();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || 'Delete failed.');
      }
    } finally {
      setHardDeleting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirmWithdraw) return;
    setWithdrawing(true);
    try {
      await fetch(`/api/v2/admin/enrolments/${confirmWithdraw}`, { method: 'DELETE' });
      setConfirmWithdraw(null);
      fetchEnrolments();
    } catch (err) {
      console.error('Failed to withdraw:', err);
    } finally {
      setWithdrawing(false);
    }
  };

  const statusColors: Record<string, string> = {
    enrolled: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-purple-100 text-purple-700',
    withdrawn: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrolments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Enrol students in courses and assign assessors</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
        >
          New Enrolment
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1">
        {([
          { key: 'all', label: 'All' },
          { key: 'active', label: 'In progress' },
          { key: 'completed', label: 'Completed' },
          { key: 'withdrawn', label: 'Withdrawn' },
        ] as const).map((c) => (
          <button
            key={c.key}
            onClick={() => { setStatusChip(c.key); setPagination((p) => ({ ...p, page: 1 })); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors ${
              statusChip === c.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div
          data-testid="bulk-toolbar"
          className="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-[6px] sticky top-0 z-10"
        >
          <span className="text-sm font-medium text-amber-900">
            {selectedIds.size} selected
            {selectedIds.size > 100 && (
              <span className="ml-2 text-xs text-red-600">
                (limit 100; deselect some)
              </span>
            )}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setBulkAction('withdraw')}
            disabled={selectedIds.size > 100 || bulkRunning}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-[6px] hover:bg-red-700 disabled:opacity-50"
          >
            Withdraw selected
          </button>
          <button
            type="button"
            onClick={runBulkExport}
            disabled={selectedIds.size > 100 || bulkRunning}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-[8px] border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Enrolment' : 'New Enrolment'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors._form && <p className="text-sm text-red-600">{errors._form[0]}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                    <select
                      value={form.userId}
                      onChange={(e) => setForm({ ...form, userId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Select a student...</option>
                      {students.map((s) => (
                        <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                      ))}
                    </select>
                    {errors.userId && <p className="text-xs text-red-500 mt-1">{errors.userId[0]}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                    <select
                      value={form.qualificationId}
                      onChange={(e) => setForm({ ...form, qualificationId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Select a course...</option>
                      {qualifications.map((q) => (
                        <option key={q._id} value={q._id}>{q.title} ({q.code})</option>
                      ))}
                    </select>
                    {errors.qualificationId && <p className="text-xs text-red-500 mt-1">{errors.qualificationId[0]}</p>}
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assessor</label>
                <select
                  value={form.assessorId}
                  onChange={(e) => setForm({ ...form, assessorId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">No assessor assigned</option>
                  {assessors.map((a) => (
                    <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cohort ID</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-Q1"
                  value={form.cohortId}
                  onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="enrolled">Enrolled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px]">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={filteredEnrolments.length === 0}
        onRetry={fetchEnrolments}
        skeleton={<DefaultListSkeleton rows={5} />}
        emptyContent={
          <EmptyState
            title="No enrolments yet"
            description={
              statusChip !== 'all'
                ? `No ${statusChip === 'active' ? 'in-progress' : statusChip} enrolments. Try a different filter.`
                : 'Enrol students in courses to start tracking their progress and assigning assessors.'
            }
            cta={
              statusChip === 'all' ? (
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
                >
                  New enrolment
                </button>
              ) : null
            }
          />
        }
      >
        <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50"
                    />
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Course</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Assessor</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Cohort</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrolments.map((e) => (
                  <tr key={e._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(e._id)}
                        onChange={() => toggleSelect(e._id)}
                        aria-label={`Select enrolment for ${e.userId?.name || 'unknown'}`}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{e.userId?.name || 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-600">{e.qualificationId?.title || 'Unknown'}</td>
                    <td className="px-5 py-3 text-gray-600">{e.assessorId?.name || 'Unassigned'}</td>
                    <td className="px-5 py-3 text-gray-600">{e.cohortId || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[e.status] || 'bg-gray-100 text-gray-600'}`}>
                        {e.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {new Date(e.enrolledAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(e)} className="text-primary hover:underline text-xs">Edit</button>
                      {e.status !== 'withdrawn' && (
                        <button onClick={() => setConfirmWithdraw(e._id)} className="text-red-600 hover:underline text-xs">Withdraw</button>
                      )}
                      <button
                        onClick={() =>
                          setConfirmHardDelete({
                            id: e._id,
                            label: `${e.userId?.name ?? 'Unknown'} → ${e.qualificationId?.title ?? 'unknown course'}`,
                          })
                        }
                        className="text-red-700 hover:underline text-xs font-medium ml-2"
                        title="Permanently delete this enrolment and ALL its assessments/evidence/work-hours"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} enrolments)
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

      <ConfirmDialog
        open={!!confirmHardDelete}
        title="Permanently delete enrolment?"
        message={
          confirmHardDelete
            ? `Delete ${confirmHardDelete.label} along with EVERY assessment, evidence file, and work-hour entry on this enrolment. The audit log entry remains. This cannot be undone.`
            : ''
        }
        confirmLabel="Permanently delete"
        destructive
        loading={hardDeleting}
        onConfirm={handleHardDelete}
        onCancel={() => setConfirmHardDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmWithdraw}
        title="Withdraw Enrolment"
        message="Are you sure you want to withdraw this student from the course?"
        confirmLabel="Withdraw"
        destructive
        loading={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setConfirmWithdraw(null)}
      />

      {/* G17 — bulk withdraw confirm */}
      <ConfirmDialog
        open={bulkAction === 'withdraw'}
        title="Withdraw selected enrolments"
        message={`Withdraw ${selectedIds.size} enrolment${selectedIds.size === 1 ? '' : 's'}? Students will lose access to those courses.`}
        confirmLabel="Withdraw"
        destructive
        loading={bulkRunning}
        onConfirm={runBulkWithdraw}
        onCancel={() => setBulkAction(null)}
      />

      {/* G17 — bulk result modal */}
      {bulkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBulkResult(null)} />
          <div className="relative bg-white rounded-[8px] shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {bulkResult.kind === 'withdraw' ? 'Bulk withdraw complete' : 'Export downloaded'}
            </h3>
            <p className="mt-3 text-sm text-gray-600">
              {bulkResult.kind === 'withdraw'
                ? `${bulkResult.updated ?? 0} enrolment(s) withdrawn.`
                : 'The CSV download should have started in your browser.'}
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setBulkResult(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
