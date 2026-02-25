'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

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
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

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

  // Withdraw
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchEnrolments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/enrolments?page=${pagination.page}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setEnrolments(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (err) {
      console.error('Failed to fetch enrolments:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page]);

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
      <div className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : enrolments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No enrolments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
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
                {enrolments.map((e) => (
                  <tr key={e._id} className="border-b border-gray-50 hover:bg-gray-50">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
    </div>
  );
}
