'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import type { UserRole } from '@/types';

interface MeResponse {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  status?: string;
  notificationPreferences?: {
    signOff?: boolean;
    iqaDecision?: boolean;
    newEnrolment?: boolean;
  };
}

const roleLabel: Record<string, string> = {
  student: 'Student / Learner',
  assessor: 'Assessor',
  iqa: 'Internal Quality Assurer',
  admin: 'Administrator',
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [prefSignOff, setPrefSignOff] = useState(true);
  const [prefIqaDecision, setPrefIqaDecision] = useState(true);
  const [prefNewEnrolment, setPrefNewEnrolment] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/users/me');
      const data = await res.json();
      if (data.success) {
        setMe(data.data);
        setName(data.data.name);
        setPhone(data.data.phone ?? '');
        setPrefSignOff(data.data.notificationPreferences?.signOff !== false);
        setPrefIqaDecision(data.data.notificationPreferences?.iqaDecision !== false);
        setPrefNewEnrolment(data.data.notificationPreferences?.newEnrolment !== false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/v2/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          notificationPreferences: {
            signOff: prefSignOff,
            iqaDecision: prefIqaDecision,
            newEnrolment: prefNewEnrolment,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not save profile.');
      } else {
        setEditing(false);
        setSuccess('Profile saved.');
        setTimeout(() => setSuccess(null), 2000);
        await load();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const onAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar must be 2 MB or smaller.');
      return;
    }
    setAvatarUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v2/users/me/avatar', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Avatar upload failed.');
      } else {
        setSuccess('Avatar updated.');
        setTimeout(() => setSuccess(null), 2000);
        await load();
        router.refresh();
      }
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Profile</h1>
        <Card>
          <div className="animate-pulse">
            <div className="flex gap-6 mb-6">
              <div className="w-16 h-16 rounded-full bg-gray-200" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!me) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Profile</h1>
        <Card>
          <p className="text-sm text-red-600">Could not load your profile. Please refresh.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
          >
            Edit profile
          </button>
        )}
      </div>

      {success && (
        <div className="p-3 rounded-[6px] bg-green-50 border border-green-200 text-sm text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
              {(me.name || 'U').charAt(0).toUpperCase()}
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 px-2 py-1 text-[10px] bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 disabled:opacity-50"
                title="Upload avatar (PNG/JPEG/WEBP/GIF, ≤ 2 MB)"
              >
                {avatarUploading ? 'Uploading…' : 'Change'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onAvatarPicked}
              className="hidden"
              aria-label="Avatar file"
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{me.name}</h2>
            <p className="text-text-secondary">{me.email}</p>
            <span className="inline-block mt-1 px-3 py-0.5 bg-primary-light text-primary text-xs font-medium rounded-full">
              {roleLabel[me.role || 'student']}
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-medium text-text-secondary mb-4">Account information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted block mb-1" htmlFor="profile-name">Full name</label>
              {editing ? (
                <input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <p className="text-sm text-text-primary font-medium">{me.name}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Email</label>
              <p className="text-sm text-text-primary font-medium">{me.email}</p>
              <p className="text-[11px] text-text-muted mt-1">Your sign-in identifier — contact your administrator to change it.</p>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1" htmlFor="profile-phone">Phone</label>
              {editing ? (
                <input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <p className="text-sm text-text-primary font-medium">{me.phone || '—'}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Role</label>
              <p className="text-sm text-text-primary font-medium">{roleLabel[me.role || 'student']}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-sm font-medium text-text-secondary mb-4">Email notifications</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefSignOff}
                onChange={(e) => setPrefSignOff(e.target.checked)}
                disabled={!editing}
                className="mt-1"
              />
              <div>
                <span className="text-sm text-text-primary">Assessor sign-off</span>
                <p className="text-xs text-text-muted">Email me when an assessor signs off one of my assessments.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefIqaDecision}
                onChange={(e) => setPrefIqaDecision(e.target.checked)}
                disabled={!editing}
                className="mt-1"
              />
              <div>
                <span className="text-sm text-text-primary">IQA decisions</span>
                <p className="text-xs text-text-muted">Email me when an IQA records a decision on a sampled assessment.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefNewEnrolment}
                onChange={(e) => setPrefNewEnrolment(e.target.checked)}
                disabled={!editing}
                className="mt-1"
              />
              <div>
                <span className="text-sm text-text-primary">New course enrolments</span>
                <p className="text-xs text-text-muted">Email me when an administrator enrols me in a new course.</p>
              </div>
            </label>
          </div>
        </div>

        {editing && (
          <div className="border-t border-border pt-6 mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setName(me.name);
                setPhone(me.phone ?? '');
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
