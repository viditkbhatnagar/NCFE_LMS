'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

interface UnitRow {
  _id: string;
  qualificationId: string;
  unitReference: string;
  title: string;
  description: string;
  moduleId?: string | null;
  qualification?: { title: string; code: string; slug: string } | null;
  module?: { title: string } | null;
}

export default function AdminUnitsPage() {
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<UnitRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/admin/units');
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setRows(json.data);
      else setError(json.error || 'Failed to load units.');
    } catch {
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/admin/units/${deleteRow._id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteRow(null);
        fetchAll();
      }
    } finally {
      setDeleting(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.unitReference.toLowerCase().includes(q) ||
          (r.qualification?.title?.toLowerCase().includes(q) ?? false),
      )
    : rows;

  // Group by course title.
  const byCourse = filtered.reduce<Record<string, UnitRow[]>>((acc, r) => {
    const key = r.qualification?.title || '— unknown course —';
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Every unit across every course. To add a new unit, open the course in
            {' '}<Link href="/admin/courses" className="text-primary hover:underline">Courses</Link>.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search by title, reference, course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={filtered.length === 0}
        onRetry={fetchAll}
        skeleton={<DefaultListSkeleton rows={5} />}
        emptyContent={
          <EmptyState
            title="No units yet"
            description={search ? 'No units match your search.' : 'Open a course on the Courses page and click "Add Unit" inside a module.'}
          />
        }
      >
        <div className="space-y-4">
          {Object.entries(byCourse).map(([course, list]) => (
            <div key={course} className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-semibold text-gray-900">{course}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {list.length} unit{list.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {list.map((u) => (
                  <div key={u._id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-gray-500">{u.unitReference}</span> — {u.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {u.module?.title ? `Module: ${u.module.title}` : 'Ungrouped (no module)'}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteRow(u)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ListStateBoundary>

      <ConfirmDialog
        open={!!deleteRow}
        title="Delete this unit?"
        message={
          deleteRow
            ? `Delete "${deleteRow.unitReference} — ${deleteRow.title}" and every learning outcome, criterion, and any evidence/assessment data tied to it. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteRow(null)}
      />
    </div>
  );
}
