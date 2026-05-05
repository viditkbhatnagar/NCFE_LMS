'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { generatePassword } from '@/lib/password-generator';

const SIGN_IN_URL = 'https://ncfe-lms.onrender.com/sign-in';

interface CreatedCredentials {
  name: string;
  email: string;
  role: string;
  password: string;
  emailSent: boolean;
  emailError?: string;
}

interface ResetCredentials {
  email: string;
  password: string;
  emailSent: boolean;
  emailError?: string;
}

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

  // Password generator UX state
  const [passwordVisible, setPasswordVisible] = useState(true);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [resetPasswordVisible, setResetPasswordVisible] = useState(true);
  const [resetCopied, setResetCopied] = useState(false);
  const [credsCopied, setCredsCopied] = useState(false);
  const [resetCredsCopied, setResetCredsCopied] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreatedCredentials | null>(null);
  const [lastReset, setLastReset] = useState<ResetCredentials | null>(null);

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
    setPasswordCopied(false);
  };

  const openCreateForm = () => {
    setForm({ name: '', email: '', password: generatePassword(), role: 'student', phone: '', status: 'active' });
    setEditingId(null);
    setErrors({});
    setPasswordVisible(true);
    setPasswordCopied(false);
    setShowForm(true);
  };

  const handleEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', status: u.status });
    setEditingId(u._id);
    setShowForm(true);
  };

  const handleGeneratePassword = () => {
    setForm((f) => ({ ...f, password: generatePassword() }));
    setPasswordCopied(false);
  };

  const handleCopyPassword = async () => {
    if (!form.password) return;
    try {
      await navigator.clipboard.writeText(form.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const handleCopyAllCredentials = async () => {
    if (!lastCreated) return;
    const block = `Name: ${lastCreated.name}\nEmail: ${lastCreated.email}\nPassword: ${lastCreated.password}\nLogin: ${SIGN_IN_URL}`;
    try {
      await navigator.clipboard.writeText(block);
      setCredsCopied(true);
      setTimeout(() => setCredsCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const handleGenerateResetPassword = () => {
    setNewPassword(generatePassword());
    setResetCopied(false);
  };

  const handleCopyResetPassword = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setResetCopied(true);
      setTimeout(() => setResetCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const handleResendWelcome = async (u: User) => {
    if (!confirm(`Resend welcome email to ${u.email}? This will generate a new password.`)) return;
    try {
      const res = await fetch(`/api/v2/admin/users/${u._id}/resend-welcome`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastCreated({
          name: u.name,
          email: u.email,
          role: u.role,
          password: data.password,
          emailSent: !!data.emailSent,
          emailError: data.emailError,
        });
      } else {
        alert(`Resend failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Resend welcome failed:', err);
      alert('Resend failed — see console for details.');
    }
  };

  const handleCopyResetCredentials = async () => {
    if (!lastReset) return;
    const block = `Email: ${lastReset.email}\nPassword: ${lastReset.password}\nLogin: ${SIGN_IN_URL}`;
    try {
      await navigator.clipboard.writeText(block);
      setResetCredsCopied(true);
      setTimeout(() => setResetCredsCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
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
        if (!editingId) {
          setLastCreated({
            name: form.name,
            email: form.email,
            role: form.role,
            password: form.password,
            emailSent: !!data.emailSent,
            emailError: data.emailError,
          });
        }
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
        const targetUser = users.find((u) => u._id === resetId);
        if (targetUser) {
          setLastReset({
            email: targetUser.email,
            password: newPassword,
            emailSent: !!data.emailSent,
            emailError: data.emailError,
          });
        }
        setResetId(null);
        setNewPassword('');
        setResetCopied(false);
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
          onClick={openCreateForm}
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
                  aria-label="Name"
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
                  aria-label="Email"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email[0]}</p>}
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="flex items-stretch gap-1">
                    <input
                      type={passwordVisible ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => { setForm({ ...form, password: e.target.value }); setPasswordCopied(false); }}
                      className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      title="Generate secure password"
                      aria-label="Generate password"
                      className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      title={passwordCopied ? 'Copied' : 'Copy password'}
                      aria-label="Copy password"
                      className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50 relative"
                    >
                      {passwordCopied ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((v) => !v)}
                      title={passwordVisible ? 'Hide password' : 'Show password'}
                      aria-label="Toggle password visibility"
                      className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
                    >
                      {passwordVisible ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Click &lsquo;Generate&rsquo; for a secure random password, or type your own.</p>
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
                      <button
                        onClick={() => {
                          setNewPassword(generatePassword());
                          setResetPasswordVisible(true);
                          setResetCopied(false);
                          setResetId(u._id);
                        }}
                        className="text-amber-600 hover:underline text-xs"
                      >
                        Reset PW
                      </button>
                      <button
                        onClick={() => handleResendWelcome(u)}
                        className="text-blue-600 hover:underline text-xs"
                        title="Resend welcome email with a fresh password"
                      >
                        Resend
                      </button>
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
            <p className="text-sm text-gray-600 mt-1">A new password has been auto-generated. Copy it before you submit.</p>
            <div className="flex items-stretch gap-1 mt-4">
              <input
                type={resetPasswordVisible ? 'text' : 'password'}
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setResetCopied(false); }}
                className="flex-1 min-w-0 px-3 py-2 text-sm font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="New password"
              />
              <button
                type="button"
                onClick={handleGenerateResetPassword}
                title="Generate secure password"
                aria-label="Generate password"
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleCopyResetPassword}
                title={resetCopied ? 'Copied' : 'Copy password'}
                aria-label="Copy password"
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
              >
                {resetCopied ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setResetPasswordVisible((v) => !v)}
                title={resetPasswordVisible ? 'Hide password' : 'Show password'}
                aria-label="Toggle password visibility"
                className="px-2 border border-gray-300 rounded-[6px] text-gray-600 hover:bg-gray-50"
              >
                {resetPasswordVisible ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Click &lsquo;Generate&rsquo; for a secure random password, or type your own.</p>
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

      {/* Post-create success modal */}
      {lastCreated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="created-title">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLastCreated(null)} />
          <div className="relative bg-white rounded-[8px] shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 id="created-title" className="text-lg font-semibold text-gray-900">User created</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex"><dt className="w-24 text-gray-500">Name:</dt><dd className="flex-1 font-medium text-gray-900">{lastCreated.name}</dd></div>
              <div className="flex"><dt className="w-24 text-gray-500">Email:</dt><dd className="flex-1 font-medium text-gray-900 break-all">{lastCreated.email}</dd></div>
              <div className="flex"><dt className="w-24 text-gray-500">Role:</dt><dd className="flex-1 font-medium text-gray-900 capitalize">{lastCreated.role}</dd></div>
              <div className="flex items-center"><dt className="w-24 text-gray-500">Password:</dt><dd className="flex-1 font-mono text-gray-900 break-all">{lastCreated.password}</dd></div>
            </dl>
            {lastCreated.emailSent ? (
              <div className="mt-4 p-3 rounded-[6px] bg-green-50 border border-green-200 text-xs text-green-800 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Email sent to <strong>{lastCreated.email}</strong> ✓ — they&rsquo;ll receive these credentials in their inbox.</span>
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Email failed — please share these credentials manually. {lastCreated.emailError ? <em>Reason: {lastCreated.emailError}</em> : null}</span>
              </div>
            )}
            <div className="mt-3 p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>This password won&rsquo;t be shown again. Copy it now if you need a backup.</span>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleCopyAllCredentials}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
              >
                {credsCopied ? 'Copied!' : 'Copy all credentials'}
              </button>
              <button
                onClick={() => setLastCreated(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-reset success modal */}
      {lastReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLastReset(null)} />
          <div className="relative bg-white rounded-[8px] shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 id="reset-title" className="text-lg font-semibold text-gray-900">Password reset</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex"><dt className="w-28 text-gray-500">Email:</dt><dd className="flex-1 font-medium text-gray-900 break-all">{lastReset.email}</dd></div>
              <div className="flex items-center"><dt className="w-28 text-gray-500">New password:</dt><dd className="flex-1 font-mono text-gray-900 break-all">{lastReset.password}</dd></div>
            </dl>
            {lastReset.emailSent ? (
              <div className="mt-4 p-3 rounded-[6px] bg-green-50 border border-green-200 text-xs text-green-800 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Email sent to <strong>{lastReset.email}</strong> ✓ — the new password is on the way.</span>
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Email failed — please share this password manually. {lastReset.emailError ? <em>Reason: {lastReset.emailError}</em> : null}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleCopyResetCredentials}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
              >
                {resetCredsCopied ? 'Copied!' : 'Copy credentials'}
              </button>
              <button
                onClick={() => setLastReset(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
