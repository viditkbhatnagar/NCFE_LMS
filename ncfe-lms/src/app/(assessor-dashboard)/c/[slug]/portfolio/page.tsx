'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import PortfolioToolbar from '@/components/assessor/PortfolioToolbar';
import EvidenceCard from '@/components/assessor/EvidenceCard';
import EvidenceListRow from '@/components/assessor/EvidenceListRow';
import EvidenceUploadModal from '@/components/assessor/EvidenceUploadModal';
import FilePreviewModal from '@/components/assessor/FilePreviewModal';
import type { PortfolioEvidence, EvidenceStatus } from '@/types';

type ViewMode = 'grid' | 'list';
type SortOrder = 'newest' | 'oldest';

interface SimpleUnit {
  _id: string;
  unitReference: string;
  title: string;
}

export default function PortfolioPage() {
  const { qualification, currentEnrollmentId, userRole, selectedLearner } = useAssessorCourse();

  const [evidence, setEvidence] = useState<PortfolioEvidence[]>([]);
  const [units, setUnits] = useState<SimpleUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<PortfolioEvidence | null>(null);
  const [uploadedBy, setUploadedBy] = useState<{ name: string; email: string } | null>(null);

  // Rename/delete state
  const [renameTarget, setRenameTarget] = useState<PortfolioEvidence | null>(null);
  const [renameLabel, setRenameLabel] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioEvidence | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter/sort state
  const [status, setStatus] = useState<EvidenceStatus | ''>('');
  const [fileType, setFileType] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Fetch units once (for upload modal unit dropdown)
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const res = await fetch(
          `/api/v2/qualifications/${qualification._id}/criteria-tree`
        );
        const json = await res.json();
        if (json.success) {
          setUnits(
            json.data.map((u: { _id: string; unitReference: string; title: string }) => ({
              _id: u._id,
              unitReference: u.unitReference,
              title: u.title,
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching units:', err);
      }
    };
    fetchUnits();
  }, [qualification._id]);

  const fetchEvidence = useCallback(async () => {
    if (!currentEnrollmentId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (status) params.set('status', status);
      if (fileType) params.set('fileType', fileType);

      const res = await fetch(
        `/api/v2/portfolio/${currentEnrollmentId}?${params}`
      );
      const json = await res.json();
      if (json.success) {
        setEvidence(json.data);
        if (json.uploadedBy) setUploadedBy(json.uploadedBy);
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEnrollmentId, status, fileType, sort]);

  useEffect(() => {
    setEvidence([]);
    fetchEvidence();
  }, [fetchEvidence]);

  const handlePreview = (e: PortfolioEvidence) => {
    setPreviewItem(e);
  };

  const handleDownload = (e: PortfolioEvidence) => {
    window.open(`/api/v2/evidence/${e._id}/download`, '_blank');
  };

  const handleRenameStart = (e: PortfolioEvidence) => {
    setRenameTarget(e);
    setRenameLabel(e.label);
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget || !renameLabel.trim()) return;
    setRenameSaving(true);
    try {
      const res = await fetch(`/api/v2/evidence/${renameTarget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: renameLabel.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setEvidence((prev) =>
          prev.map((e) =>
            e._id === renameTarget._id ? { ...e, label: renameLabel.trim() } : e
          )
        );
        setRenameTarget(null);
      }
    } catch (err) {
      console.error('Error renaming evidence:', err);
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v2/evidence/${deleteTarget._id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setEvidence((prev) => prev.filter((e) => e._id !== deleteTarget._id));
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('Error deleting evidence:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // No learner selected
  if (!currentEnrollmentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-500 mb-1">
          {userRole === 'student'
            ? 'No enrollment found'
            : 'Select a learner to view their portfolio'}
        </p>
        <p className="text-sm text-gray-400">
          {userRole === 'student'
            ? 'You do not have an active enrollment for this course'
            : 'Use the learner dropdown in the top bar'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Portfolio</h1>
        <PortfolioToolbar
          status={status}
          onStatusChange={setStatus}
          fileType={fileType}
          onFileTypeChange={setFileType}
          sort={sort}
          onSortChange={setSort}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onUploadClick={() => setShowUploadModal(true)}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : evidence.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg
              className="w-16 h-16 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-500 mb-1">
              No evidence found
            </p>
            <p className="text-sm text-gray-400">
              No evidence has been uploaded yet.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {evidence.map((e) => (
              <EvidenceCard
                key={e._id}
                evidence={e}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onRename={handleRenameStart}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((e) => (
                  <EvidenceListRow
                    key={e._id}
                    evidence={e}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    onRename={handleRenameStart}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload modal */}
      <EvidenceUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        enrollmentId={currentEnrollmentId}
        units={units}
        onUploaded={fetchEvidence}
      />

      {previewItem && (
        <FilePreviewModal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          downloadUrl={`/api/v2/evidence/${previewItem._id}/download`}
          fileName={previewItem.fileName}
          fileType={previewItem.fileType}
          label={previewItem.label}
          metadata={{
            size: previewItem.fileSize,
            uploadedAt: previewItem.uploadedAt,
            status: previewItem.status,
            description: previewItem.description,
            ...(selectedLearner ? { learner: { name: selectedLearner.name, email: selectedLearner.email } } : {}),
            ...(uploadedBy ? { uploader: uploadedBy } : {}),
          }}
        />
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRenameTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Rename Evidence</h3>
            <p className="text-sm text-gray-500 mt-1">Update the label for this evidence.</p>
            <input
              type="text"
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
              className="w-full mt-4 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={renameSaving || !renameLabel.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50"
              >
                {renameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Delete Evidence</h3>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure you want to delete <span className="font-medium">&ldquo;{deleteTarget.label}&rdquo;</span>?
              This will permanently remove the file and cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
