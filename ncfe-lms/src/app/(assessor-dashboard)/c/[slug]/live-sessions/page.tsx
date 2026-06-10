'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';
import { uploadLiveSessionRecording } from '@/lib/recording-upload';

interface LiveSession {
  _id: string;
  title: string;
  description: string;
  cohortId: string;
  meetingLink: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  recordingUrl?: string;
  recordingLink?: string;
}

const EMPTY_FORM = {
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

export default function LiveSessionsPage() {
  const { qualification, userRole } = useAssessorCourse();
  const canManage = userRole === 'assessor' || userRole === 'admin';

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/live-sessions?qualificationId=${qualification._id}`);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setSessions(json.data);
        setCohorts(json.cohorts || []);
      } else {
        setError(json.error || 'Failed to load live sessions.');
      }
    } catch (err) {
      console.error('Error fetching live sessions:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [qualification._id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: LiveSession) => {
    setEditingId(s._id);
    setForm({
      title: s.title,
      description: s.description || '',
      cohortId: s.cohortId || '',
      meetingLink: s.meetingLink,
      // datetime-local wants 'YYYY-MM-DDTHH:mm'
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
          ...(editingId ? {} : { qualificationId: qualification._id }),
          title: form.title,
          description: form.description,
          cohortId: form.cohortId,
          meetingLink: form.meetingLink,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : '',
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
    setUploadPct(0);
    setError(null);
    try {
      // Direct-to-S3 presigned upload — large videos never route through the
      // server (which OOM-crashed it → the 502 admins saw).
      const result = await uploadLiveSessionRecording(sessionId, file, setUploadPct);
      if (result.ok) fetchSessions();
      else setError(result.error || 'Recording upload failed.');
    } finally {
      setUploadingFor(null);
      setUploadPct(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const now = Date.now();
  const upcoming = sessions.filter(
    (s) => s.status !== 'cancelled' && new Date(s.scheduledAt).getTime() >= now,
  );
  const past = sessions.filter(
    (s) => s.status === 'cancelled' || new Date(s.scheduledAt).getTime() < now,
  );

  const renderCard = (s: LiveSession) => {
    const isPast = s.status === 'cancelled' || new Date(s.scheduledAt).getTime() < now;
    return (
      <div key={s._id} className="bg-white rounded-[8px] border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{s.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fmtDateTime(s.scheduledAt)} · {s.durationMinutes} min
              {s.cohortId ? ` · Cohort ${s.cohortId}` : ' · All cohorts'}
            </p>
            {s.description && (
              <p className="text-xs text-gray-600 mt-1.5">{s.description}</p>
            )}
          </div>
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

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {!isPast && s.status !== 'cancelled' && (
            <a
              href={s.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
            >
              Join class
            </a>
          )}
          {(s.recordingLink || s.recordingUrl) && (
            <a
              href={s.recordingLink || `/api/v2/live-sessions/${s._id}/recording/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
            >
              Watch recording
            </a>
          )}
          {/* Upload is available for ANY session without a recording yet — not
              just "past" ones. The session's scheduled time is irrelevant to
              whether a recording can be attached (a class may run early, or the
              clock/timezone may not yet read the slot as past), and gating on
              isPast was hiding the button for managers — the admin Live Sessions
              page never gated it, which is why uploads worked there but not here. */}
          {canManage && !s.recordingLink && !s.recordingUrl && (
            uploadingFor === s._id ? (
              <span className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 rounded-[6px]">
                Uploading… {uploadPct}%
              </span>
            ) : (
              <button
                onClick={() => { setUploadingFor(s._id); fileRef.current?.click(); }}
                disabled={uploadingFor !== null}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50 disabled:opacity-50"
              >
                Upload recording
              </button>
            )
          )}
          {canManage && (
            <>
              <button
                onClick={() => openEdit(s)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => setDeleteId(s._id)}
                className="px-3 py-1.5 text-xs font-medium text-red-500 hover:underline"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Classes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Scheduled live sessions and recordings for this course
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
          >
            Schedule a session
          </button>
        )}
      </div>

      {/* Hidden file input for recording uploads */}
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleRecordingPick}
      />

      {/* Create / edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-[8px] border border-gray-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">
            {editingId ? 'Edit live session' : 'Schedule a live session'}
          </p>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <input
            placeholder="Session title (e.g. Week 3 — Observation practice)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            placeholder="Meeting link (Zoom / Google Meet / Teams URL)"
            value={form.meetingLink}
            onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date &amp; time</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              >
                <option value="">All cohorts</option>
                {cohorts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Recording link <span className="text-gray-400">(optional — Google Drive, OneDrive, YouTube, etc.)</span>
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/…"
              value={form.recordingLink}
              onChange={(e) => setForm({ ...form, recordingLink: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste a link to the recording instead of uploading a file. Either works — the link is shown to learners as a &ldquo;Watch recording&rdquo; button.
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
        skeleton={<DefaultListSkeleton rows={3} />}
        emptyContent={
          <EmptyState
            title="No live classes yet"
            description={
              canManage
                ? 'Schedule a live class with a meeting link — enrolled learners will be notified and can join from here.'
                : 'When your assessor schedules a live class, it will appear here with a join link.'
            }
            cta={
              canManage ? (
                <button
                  onClick={openCreate}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
                >
                  Schedule a session
                </button>
              ) : null
            }
          />
        }
      >
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-3">{upcoming.map(renderCard)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Past ({past.length})
              </h2>
              <div className="space-y-3">{past.map(renderCard)}</div>
            </div>
          )}
        </div>
      </ListStateBoundary>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete live session?"
        message="This removes the scheduled session and its recording (if any). This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
