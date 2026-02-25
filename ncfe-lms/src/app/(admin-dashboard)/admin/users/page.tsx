'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  centreId?: { _id: string; name: string; code: string } | null;
  createdAt: string;
}

const roles = ['all', 'student', 'assessor', 'iqa', 'admin'] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as string, phone: '', status: 'active' as string });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Delete/deactivate
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'deactivate' | 'activate' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Password reset
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pagination.page), limit: '20' });
    if (activeRole !== 'all') params.set('role', activeRole);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/v2/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [activeRole, search, pagination.page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'student', phone: '', status: 'active' });
    setEditingId(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', status: u.status });
    setEditingId(u._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const url = editingId ? `/api/v2/admin/users/${editingId}` : '/api/v2/admin/users';
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId
      ? { name: form.name, email: form.email, role: form.role, phone: form.phone, status: form.status }
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
        fetchUsers();
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

  const handleToggleStatus = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.action === 'deactivate') {
        await fetch(`/api/v2/admin/users/${confirmAction.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/v2/admin/users/${confirmAction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
      }
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetId || !newPassword) return;
    setResetLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/users/${resetId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setResetId(null);
        setNewPassword('');
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage students, assessors, and IQA users</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
        >
          Add User
        </button>
      </div>

      {/* Role tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => { setActiveRole(r); setPagination((p) => ({ ...p, page: 1 })); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors ${
                activeRole === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
          className="w-full max-w-xs px-4 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-[8px] border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit User' : 'New User'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors._form && <p className="text-sm text-red-600">{errors._form[0]}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name[0]}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email[0]}</p>}
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password[0]}</p>}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="student">Student</option>
                  <option value="assessor">Assessor</option>
                  <option value="iqa">IQA</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Centre</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{u.centreId?.name || '-'}</td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => handleEdit(u)} className="text-primary hover:underline text-xs">Edit</button>
                      <button onClick={() => setResetId(u._id)} className="text-amber-600 hover:underline text-xs">Reset PW</button>
                      {u.status === 'active' ? (
                        <button onClick={() => setConfirmAction({ id: u._id, action: 'deactivate' })} className="text-red-600 hover:underline text-xs">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => setConfirmAction({ id: u._id, action: 'activate' })} className="text-green-600 hover:underline text-xs">
                          Activate
                        </button>
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
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
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

      {/* Deactivate/Activate confirm */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        message={confirmAction?.action === 'deactivate'
          ? 'Are you sure you want to deactivate this user? They will not be able to sign in.'
          : 'Are you sure you want to reactivate this user?'}
        confirmLabel={confirmAction?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
        destructive={confirmAction?.action === 'deactivate'}
        loading={actionLoading}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Password reset dialog */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setResetId(null); setNewPassword(''); }} />
          <div className="relative bg-white rounded-[8px] shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
            <p className="text-sm text-gray-600 mt-1">Enter a new password for this user.</p>
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full mt-4 px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setResetId(null); setNewPassword(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || newPassword.length < 8}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] disabled:opacity-50"
              >
                {resetLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
