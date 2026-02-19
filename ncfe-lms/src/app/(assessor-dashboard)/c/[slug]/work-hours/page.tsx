'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import DayNavigator from '@/components/assessor/DayNavigator';
import WorkHourEntry from '@/components/assessor/WorkHourEntry';
import WorkHourEntryForm from '@/components/assessor/WorkHourEntryForm';
import type { WorkHourEntryItem } from '@/types';

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function WorkHoursPage() {
  const { currentEnrollmentId, selectedLearner, userRole } = useAssessorCourse();
  const isStudent = userRole === 'student';

  const [entries, setEntries] = useState<WorkHourEntryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkHourEntryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!currentEnrollmentId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        enrollmentId: currentEnrollmentId,
        date: formatDateParam(selectedDate),
      });
      const res = await fetch(`/api/v2/work-hours?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) setEntries(json.data);
    } catch (err) {
      console.error('Error fetching work hours:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEnrollmentId, selectedDate]);

  useEffect(() => {
    setEntries([]);
    fetchEntries();
  }, [fetchEntries]);

  const handleNewClick = () => {
    if (!selectedLearner) return;
    setEditingEntry(null);
    setShowForm(true);
  };

  const handleEdit = (entry: WorkHourEntryItem) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      const res = await fetch(`/api/v2/work-hours/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteConfirmId(null);
        fetchEntries();
      }
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingEntry(null);
    fetchEntries();
  };

  // Daily total
  const totalMinutes = entries.reduce((acc, e) => acc + e.hours * 60 + e.minutes, 0);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;

  // No enrollment / no learner selected
  if (!currentEnrollmentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium text-gray-500 mb-1">
          {isStudent ? 'No enrollment found' : 'Select a learner to view work hours'}
        </p>
        {!isStudent && (
          <p className="text-sm text-gray-400">Use the learner dropdown in the top bar</p>
        )}
        {isStudent && (
          <p className="text-sm text-gray-400">You do not have an active enrollment for this course</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Work Hours Log</h1>
        <button
          onClick={handleNewClick}
          disabled={!selectedLearner}
          className="px-4 py-2 bg-gray-900 text-white rounded-[6px] text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          + New
        </button>
      </div>

      {/* Day navigator */}
      <DayNavigator date={selectedDate} onDateChange={setSelectedDate} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {/* New / Edit form */}
        {showForm && selectedLearner && (
          <WorkHourEntryForm
            learnerName={selectedLearner.name}
            enrollmentId={currentEnrollmentId}
            learnerId={selectedLearner._id}
            date={formatDateParam(selectedDate)}
            initialData={editingEntry || undefined}
            onSave={handleSaved}
            onCancel={() => {
              setShowForm(false);
              setEditingEntry(null);
            }}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 && !showForm ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-500 mb-1">No time logs for this date</p>
            <p className="text-sm text-gray-400">Click &quot;+ New&quot; to add a work hours entry</p>
          </div>
        ) : (
          entries.map((entry) => (
            <WorkHourEntry
              key={entry._id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Daily summary */}
      {entries.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Daily Total</span>
          <span className="text-sm font-bold text-gray-900">
            {totalH}h {totalM}m
          </span>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3 text-sm">
          <span>Click delete again to confirm</span>
          <button
            onClick={() => setDeleteConfirmId(null)}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
