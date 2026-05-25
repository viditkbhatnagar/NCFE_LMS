'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

interface ModuleRow {
  _id: string;
  qualificationId: string;
  title: string;
  description: string;
  order: number;
  qualification?: { title: string; code: string; slug: string } | null;
}

export default function AdminModulesPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<ModuleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/admin/modules');
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setRows(json.data);
      else setError(json.error || 'Failed to load modules.');
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
      const res = await fetch(`/api/v2/admin/modules/${deleteRow._id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteRow(null);
        fetchAll();
      }
    } finally {
      setDeleting(false);
    }
  };

  // Group by course title.
  const byCourse = rows.reduce<Record<string, ModuleRow[]>>((acc, r) => {
    const key = r.qualification?.title || '— unknown course —';
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Every module across every course. To add a new module, open the course in
          {' '}<Link href="/admin/courses" className="text-primary hover:underline">Courses</Link>.
        </p>
      </div>

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        onRetry={fetchAll}
        skeleton={<DefaultListSkeleton rows={4} />}
        emptyContent={
          <EmptyState
            title="No modules yet"
            description="Open a course on the Courses page and click 'Add Module' to create one."
          />
        }
      >
        <div className="space-y-4">
          {Object.entries(byCourse).map(([course, list]) => (
            <div key={course} className="bg-white rounded-[8px] border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <div>
                  <span className="text-sm font-semibold text-gray-900">{course}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {list.length} module{list.length === 1 ? '' : 's'}
                  </span>
                </div>
                {list[0]?.qualification?.slug && (
                  <Link
                    href={`/admin/courses`}
                    className="text-xs text-primary hover:underline"
                  >
                    Manage course →
                  </Link>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {list.map((m) => (
                  <div key={m._id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteRow(m)}
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
        title="Delete this module?"
        message={
          deleteRow
            ? `Delete module "${deleteRow.title}". Its units are kept and move to the "Ungrouped units" section of the course. This cannot be undone.`
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
