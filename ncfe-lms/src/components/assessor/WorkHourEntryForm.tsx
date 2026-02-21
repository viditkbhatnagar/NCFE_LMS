'use client';

import { useState } from 'react';
import type { WorkHourEntryItem } from '@/types';

interface WorkHourEntryFormProps {
  learnerName: string;
  enrollmentId: string;
  learnerId: string;
  date: string;
  initialData?: WorkHourEntryItem;
  onSave: () => void;
  onCancel: () => void;
}

export default function WorkHourEntryForm({
  learnerName,
  enrollmentId,
  learnerId,
  date,
  initialData,
  onSave,
  onCancel,
}: WorkHourEntryFormProps) {
  const [hours, setHours] = useState(initialData?.hours ?? 0);
  const [minutes, setMinutes] = useState(initialData?.minutes ?? 0);
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!initialData;

  const initials = learnerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSubmit = async () => {
    if (hours === 0 && minutes === 0) {
      setError('Please enter at least some time');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const url = isEdit
        ? `/api/v2/work-hours/${initialData._id}`
        : '/api/v2/work-hours';
      const method = isEdit ? 'PUT' : 'POST';

      const body = isEdit
        ? { hours, minutes, notes, date }
        : { enrollmentId, learnerId, date, hours, minutes, notes };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Failed to save');
        return;
      }

      onSave();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-brand-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-brand-600 shrink-0">
          {initials}
        </div>
        <div>
          <span className="text-sm font-medium text-gray-900">{learnerName}</span>
          <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
            {isEdit ? 'Edit Entry' : 'New Entry'}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes here"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />

        {/* Time inputs + actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
              className="w-14 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-xs text-gray-500">h</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className="w-14 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-xs text-gray-500">m</span>
          </div>

          <div className="flex-1" />

          <button
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Cancel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="p-1.5 rounded hover:bg-brand-50 text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
            title="Save"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
