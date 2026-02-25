'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface Qualification {
  _id: string;
  title: string;
  slug: string;
  level: number;
  code: string;
  awardingBody: string;
  status: string;
  unitCount: number;
  createdAt: string;
}

export default function AdminCoursesPage() {
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', level: 3, code: '', awardingBody: 'NCFE/CACHE', description: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchQualifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/admin/qualifications?search=${encodeURIComponent(search)}&limit=50`);
      const data = await res.json();
      if (data.success) setQualifications(data.data);
    } catch (err) {
      console.error('Failed to fetch qualifications:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchQualifications();
  }, [fetchQualifications]);

  const resetForm = () => {
    setForm({ title: '', level: 3, code: '', awardingBody: 'NCFE/CACHE', description: '' });
    setEditingId(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (q: Qualification) => {
    setForm({ title: q.title, level: q.level, code: q.code, awardingBody: q.awardingBody, description: '' });
    setEditingId(q._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const url = editingId
      ? `/api/v2/admin/qualifications/${editingId}`
      : '/api/v2/admin/qualifications';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchQualifications();
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

  const handleDeactivate = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/admin/qualifications/${confirmDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setConfirmDelete(null);
        fetchQualifications();
      }
    } catch (err) {
      console.error('Failed to deactivate:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage qualifications, units, and assessment criteria</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
        >
          Add Course
        </button>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by title or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-[8px] border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Course' : 'New Course'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors._form && (
              <p className="text-sm text-red-600">{errors._form[0]}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title[0]}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code[0]}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
                    <option key={l} value={l}>Level {l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Awarding Body</label>
                <input
                  type="text"
                  value={form.awardingBody}
                  onChange={(e) => setForm({ ...form, awardingBody: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-50"
              >
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
        ) : qualifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No courses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Units</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {qualifications.map((q) => (
                  <tr key={q._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/courses/${q._id}`} className="text-primary hover:underline font-medium">
                        {q.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{q.code}</td>
                    <td className="px-5 py-3 text-gray-600">{q.level}</td>
                    <td className="px-5 py-3 text-gray-600">{q.unitCount}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        q.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleEdit(q)} className="text-primary hover:underline text-xs mr-3">
                        Edit
                      </button>
                      {q.status === 'active' && (
                        <button onClick={() => setConfirmDelete(q._id)} className="text-red-600 hover:underline text-xs">
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Deactivate Course"
        message="Are you sure you want to deactivate this course? It will no longer be visible to users."
        confirmLabel="Deactivate"
        destructive
        loading={deleting}
        onConfirm={handleDeactivate}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
