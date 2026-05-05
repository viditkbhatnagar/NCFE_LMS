'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import FileManagerToolbar from '@/components/assessor/FileManagerToolbar';
import FileBreadcrumbs from '@/components/assessor/FileBreadcrumbs';
import FileGrid from '@/components/assessor/FileGrid';
import FileListView from '@/components/assessor/FileListView';
import FileUploadModal from '@/components/assessor/FileUploadModal';
import NewFolderModal from '@/components/assessor/NewFolderModal';
import FilePreviewModal from '@/components/assessor/FilePreviewModal';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import type { FileItem, FolderBreadcrumb } from '@/types';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

type ViewMode = 'grid' | 'list';

export default function CourseDocumentsPage() {
  const { qualification, userRole } = useAssessorCourse();
  const readOnly = userRole === 'student';

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ qualificationId: qualification._id });
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (fileTypeFilter) params.set('fileType', fileTypeFilter);

      const res = await fetch(`/api/v2/course-documents?${params}`);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setItems(json.data);
      else setError(json.error || 'Failed to load course documents.');
    } catch (err) {
      console.error('Error fetching course documents:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [qualification._id, currentFolderId, fileTypeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleItemClick = (item: FileItem) => {
    if (item.isFolder) {
      setBreadcrumbs((prev) => [...prev, { _id: item._id, name: item.fileName }]);
      setCurrentFolderId(item._id);
    }
  };

  const handleBreadcrumbNavigate = (folderId: string | null) => {
    if (folderId === null) {
      setBreadcrumbs([]);
      setCurrentFolderId(null);
    } else {
      const idx = breadcrumbs.findIndex((b) => b._id === folderId);
      if (idx >= 0) {
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
        setCurrentFolderId(folderId);
      }
    }
  };

  const handleNewFolder = async (name: string) => {
    try {
      const res = await fetch('/api/v2/course-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: name,
          qualificationId: qualification._id,
          folderId: currentFolderId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowFolderModal(false);
        fetchItems();
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/v2/course-documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: newName }),
      });
      const json = await res.json();
      if (json.success) fetchItems();
    } catch (err) {
      console.error('Error renaming:', err);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const performDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/course-documents/${deleteConfirmId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteConfirmId(null);
        fetchItems();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = (item: FileItem) => {
    if (!item.isFolder) setPreviewItem(item);
  };

  const handleDownload = (item: FileItem) => {
    if (!item.isFolder) {
      window.open(`/api/v2/course-documents/${item._id}/download`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Course Documents</h1>
        <FileManagerToolbar
          fileTypeFilter={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onUpload={readOnly ? undefined : () => setShowUploadModal(true)}
          onNewFolder={readOnly ? undefined : () => setShowFolderModal(true)}
        />
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <FileBreadcrumbs
          path={breadcrumbs}
          onNavigate={handleBreadcrumbNavigate}
          rootLabel="Course Documents"
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <ListStateBoundary
          loading={loading}
          error={error}
          isEmpty={items.length === 0}
          onRetry={fetchItems}
          skeleton={<DefaultListSkeleton rows={4} />}
          emptyContent={
            <EmptyState
              title="No course documents yet"
              description={
                fileTypeFilter || currentFolderId
                  ? 'No documents match the current filter or folder.'
                  : readOnly
                    ? 'No course documents have been uploaded yet.'
                    : 'Upload course documents to share with learners and assessors.'
              }
              cta={
                !readOnly && !fileTypeFilter && !currentFolderId ? (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90"
                  >
                    Upload document
                  </button>
                ) : null
              }
            />
          }
        >
        {viewMode === 'grid' ? (
          <FileGrid
            items={items}
            onItemClick={handleItemClick}
            onRename={readOnly ? undefined : handleRename}
            onDelete={readOnly ? undefined : handleDelete}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        ) : (
          <FileListView
            items={items}
            onItemClick={handleItemClick}
            onRename={readOnly ? undefined : handleRename}
            onDelete={readOnly ? undefined : handleDelete}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        )}
        </ListStateBoundary>
      </div>

      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete this item?"
        message="This permanently removes the file or folder from storage. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Modals */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadEndpoint="/api/v2/course-documents"
        extraFields={{
          qualificationId: qualification._id,
          folderId: currentFolderId || '',
        }}
        onUploaded={fetchItems}
      />

      <NewFolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onConfirm={handleNewFolder}
      />

      {previewItem && (
        <FilePreviewModal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          downloadUrl={`/api/v2/course-documents/${previewItem._id}/download`}
          fileName={previewItem.fileName}
          fileType={previewItem.fileType}
          metadata={{
            size: previewItem.fileSize,
            uploadedAt: previewItem.createdAt,
            uploader: previewItem.uploadedBy ? { name: previewItem.uploadedBy.name, email: previewItem.uploadedBy.email } : undefined,
          }}
        />
      )}
    </div>
  );
}
