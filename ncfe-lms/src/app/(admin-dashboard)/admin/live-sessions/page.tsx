'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

interface LiveSession {
  _id: string;
  qualificationId: string;
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

interface CourseOption {
  _id: string;
  title: string;
  code: string;
}

const EMPTY_FORM = {
  qualificationId: '',
  title: '',
  description: '',
  cohortId: '',
  meetingLink: '',
  scheduledAt: '',
  durationMinutes: 60,
  recordingLink: '',
};

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

export default function AdminLiveSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([]);
  const [cohortsForCourse, setCohortsForCourse] = useState<string[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      else setError(json.error || 'Failed to load live sessions.');
    } catch (err) {
      console.error('Error fetching live sessions:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load courses once for the create form's course picker.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v2/admin/qualifications?limit=200&status=active');
        const json = await res.json();
        if (json.success) setCourseOptions(json.data);
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // When the form's course changes, pull that course's cohorts for the picker.
  useEffect(() => {
    if (!form.qualificationId) {
      setCohortsForCourse([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v2/live-sessions?qualificationId=${form.qualificationId}`);
        const json = await res.json();
        if (!cancelled && json.success) setCohortsForCourse(json.cohorts || []);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [form.qualificationId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: LiveSession) => {
    setEditingId(s._id);
    setForm({
      qualificationId: s.qualificationId,
      title: s.title,
      description: s.description || '',
      cohortId: s.cohortId || '',
      meetingLink: s.meetingLink,
      scheduledAt: new Date(s.scheduledAt).toISOString().slice(0, 16),
      durationMinutes: s.durationMinutes,
      recordingLink: s.recordingLink || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const url = editingId
        ? `/api/v2/live-sessions/${editingId}`
        : '/api/v2/live-sessions';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? {} : { qualificationId: form.qualificationId }),
          title: form.title,
          description: form.description,
          cohortId: form.cohortId,
          meetingLink: form.meetingLink,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : '',
          durationMinutes: Number(form.durationMinutes) || 60,
          recordingLink: form.recordingLink || '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        fetchSessions();
      } else {
        setFormError(
          json.errors
            ? Object.values(json.errors).flat().join(', ')
            : json.error || 'Failed to save session.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/live-sessions/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteId(null);
        fetchSessions();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleRecordingPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sessionId = uploadingFor;
    if (!file || !sessionId) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v2/live-sessions/${sessionId}/recording`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) fetchSessions();
      else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Recording upload failed.');
      }
    } finally {
      setUploadingFor(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Group sessions by course title for the rendered list.
  const byCourse = sessions.reduce<Record<string, LiveSession[]>>((acc, s) => {
    const key = s.qualification?.title || '— unknown course —';
    (acc[key] ||= []).push(s);
    return acc;
  }, {});

  const renderRow = (s: LiveSession) => {
    const isPast =
      s.status === 'cancelled' || new Date(s.scheduledAt).getTime() < Date.now();
    return (
      <div key={s._id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
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
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtDateTime(s.scheduledAt)} · {s.durationMinutes} min ·{' '}
            {s.cohortId ? `Cohort ${s.cohortId}` : 'All cohorts'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isPast && s.status !== 'cancelled' && (
            <a
              href={s.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
            >
              Join
            </a>
          )}
          {(s.recordingLink || s.recordingUrl) && (
            <a
              href={s.recordingLink || `/api/v2/live-sessions/${s._id}/recording/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Watch
            </a>
          )}
          {!s.recordingLink && !s.recordingUrl && (
            <button
              onClick={() => { setUploadingFor(s._id); fileRef.current?.click(); }}
              className="px-2.5 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Upload
            </button>
          )}
          <button
            onClick={() => openEdit(s)}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteId(s._id)}
            className="px-2.5 py-1 text-xs font-medium text-red-500 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Sessions</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Schedule and manage live classes across every course
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
        >
          Schedule a session
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleRecordingPick}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-[8px] border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">
            {editingId ? 'Edit live session' : 'Schedule a live session'}
          </p>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          {!editingId && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Course</label>
              <select
                required
                value={form.qualificationId}
                onChange={(e) => setForm({ ...form, qualificationId: e.target.value, cohortId: '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select a course…</option>
                {courseOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <input
            placeholder="Session title (e.g. Week 3 — Observation practice)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="url"
            placeholder="Meeting link (Zoom / Google Meet / Teams URL)"
            value={form.meetingLink}
            onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date &amp; time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
              <input
                type="number"
                min={5}
                max={600}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cohort</label>
              <select
                value={form.cohortId}
                onChange={(e) => setForm({ ...form, cohortId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={!form.qualificationId && !editingId}
              >
                <option value="">All cohorts</option>
                {cohortsForCourse.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Recording link <span className="text-gray-400">(optional — Google Drive, OneDrive, YouTube)</span>
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/…"
              value={form.recordingLink}
              onChange={(e) => setForm({ ...form, recordingLink: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste a link instead of uploading the file — useful for large recordings hosted on Drive / OneDrive.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update session' : 'Schedule session'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={sessions.length === 0}
        onRetry={fetchSessions}
        skeleton={<DefaultListSkeleton rows={4} />}
        emptyContent={
          <EmptyState
            title="No live sessions scheduled"
            description="Schedule a live class on any course. Enrolled learners (or just one cohort, if you pick one) will be notified and see a Join button."
            cta={
              <button
                onClick={openCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
              >
                Schedule a session
              </button>
            }
          />
        }
      >
        <div className="space-y-4">
          {Object.entries(byCourse).map(([course, list]) => (
            <div key={course} className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900">{course}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {list.length} session{list.length === 1 ? '' : 's'}
                </span>
              </div>
              {list.map(renderRow)}
            </div>
          ))}
        </div>
      </ListStateBoundary>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete live session?"
        message="This removes the scheduled session and any uploaded recording. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
