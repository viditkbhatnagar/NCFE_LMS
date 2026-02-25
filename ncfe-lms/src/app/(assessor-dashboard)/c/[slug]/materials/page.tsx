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
import type { FileItem, FolderBreadcrumb, MaterialItem } from '@/types';

type ViewMode = 'grid' | 'list';

// Adapt MaterialItem to FileItem for shared components
function materialToFileItem(m: MaterialItem): FileItem {
  // Use the actual fileName (with extension) so FileCard can derive the correct icon.
  // Fall back to title only if fileName is empty.
  const displayName = m.fileName || m.title;
  return {
    _id: m._id,
    fileName: displayName,
    fileUrl: m.fileUrl,
    fileType: m.fileType,
    fileSize: m.fileSize,
    isFolder: m.isFolder,
    folderId: m.folderId,
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export default function MaterialsPage() {
  const { qualification, userRole } = useAssessorCourse();
  const readOnly = userRole === 'student';

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ qualificationId: qualification._id });
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (fileTypeFilter) params.set('fileType', fileTypeFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/v2/materials?${params}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.map((m: MaterialItem) => materialToFileItem(m)));
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  }, [qualification._id, currentFolderId, fileTypeFilter, categoryFilter]);

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
      const res = await fetch('/api/v2/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          qualificationId: qualification._id,
          folderId: currentFolderId,
        }),
      });
      const json = await res.json();
      if (json.success) fetchItems();
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/v2/materials/${id}`, {
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

  const handleDelete = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }
    try {
      const res = await fetch(`/api/v2/materials/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteConfirmId(null);
        fetchItems();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handlePreview = (item: FileItem) => {
    if (!item.isFolder) setPreviewItem(item);
  };

  const handleDownload = (item: FileItem) => {
    if (!item.isFolder) {
      window.open(`/api/v2/materials/${item._id}/download`, '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Materials</h1>
        <FileManagerToolbar
          fileTypeFilter={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
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
          rootLabel="Materials"
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-500 mb-1">No materials found</p>
            <p className="text-sm text-gray-400">No materials have been uploaded to this course yet.</p>
          </div>
        ) : viewMode === 'grid' ? (
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
      </div>

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

      {/* Modals */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadEndpoint="/api/v2/materials"
        extraFields={{
          qualificationId: qualification._id,
          folderId: currentFolderId || '',
        }}
        onUploaded={fetchItems}
        showTitle
        showCategory
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
          downloadUrl={`/api/v2/materials/${previewItem._id}/download`}
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
