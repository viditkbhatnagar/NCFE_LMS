'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import FileManagerToolbar from '@/components/assessor/FileManagerToolbar';
import FileBreadcrumbs from '@/components/assessor/FileBreadcrumbs';
import FileGrid from '@/components/assessor/FileGrid';
import FileListView from '@/components/assessor/FileListView';
import FileUploadModal from '@/components/assessor/FileUploadModal';
import FilePreviewModal from '@/components/assessor/FilePreviewModal';
import type { FileItem, FolderBreadcrumb } from '@/types';

type ViewMode = 'grid' | 'list';

export default function PersonalDocumentsPage() {
  const { selectedLearner, userRole } = useAssessorCourse();
  const isStudent = userRole === 'student';

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);

  const fetchItems = useCallback(async () => {
    // Students don't need selectedLearner — API auto-scopes to own docs
    if (!isStudent && !selectedLearner) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!isStudent && selectedLearner) {
        params.set('userId', selectedLearner._id);
      }
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (fileTypeFilter) params.set('fileType', fileTypeFilter);

      const res = await fetch(`/api/v2/personal-documents?${params}`);
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (err) {
      console.error('Error fetching personal documents:', err);
    } finally {
      setLoading(false);
    }
  }, [isStudent, selectedLearner?._id, currentFolderId, fileTypeFilter]);

  // Reset state when learner changes (assessor only)
  useEffect(() => {
    if (!isStudent) {
      setItems([]);
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLearner?._id]);

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

  const handlePreview = (item: FileItem) => {
    if (!item.isFolder) setPreviewItem(item);
  };

  const handleDownload = (item: FileItem) => {
    if (!item.isFolder) {
      window.open(`/api/v2/personal-documents/${item._id}/download`, '_blank');
    }
  };

  // Assessor with no learner selected
  if (!isStudent && !selectedLearner) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-lg font-medium text-gray-500 mb-1">Select a learner to view their documents</p>
        <p className="text-sm text-gray-400">Use the learner dropdown in the top bar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Personal Documents</h1>
        <FileManagerToolbar
          fileTypeFilter={fileTypeFilter}
          onFileTypeChange={setFileTypeFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onUpload={isStudent ? () => setShowUploadModal(true) : undefined}
        />
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <FileBreadcrumbs
          path={breadcrumbs}
          onNavigate={handleBreadcrumbNavigate}
          rootLabel="Personal Documents"
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
            <p className="text-lg font-medium text-gray-500 mb-1">No personal documents found</p>
            <p className="text-sm text-gray-400">No personal documents are available yet.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <FileGrid
            items={items}
            onItemClick={handleItemClick}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        ) : (
          <FileListView
            items={items}
            onItemClick={handleItemClick}
            onPreview={handlePreview}
            onDownload={handleDownload}
          />
        )}
      </div>

      {/* Upload modal (student only) */}
      {isStudent && (
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          uploadEndpoint="/api/v2/personal-documents"
          extraFields={{
            folderId: currentFolderId || '',
          }}
          onUploaded={fetchItems}
        />
      )}

      {previewItem && (
        <FilePreviewModal
          isOpen={!!previewItem}
          onClose={() => setPreviewItem(null)}
          downloadUrl={`/api/v2/personal-documents/${previewItem._id}/download`}
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
