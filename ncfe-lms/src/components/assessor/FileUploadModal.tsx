'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadEndpoint: string;
  extraFields: Record<string, string>;
  onUploaded: () => void;
  showTitle?: boolean;
  showCategory?: boolean;
}

export default function FileUploadModal({
  isOpen,
  onClose,
  uploadEndpoint,
  extraFields,
  onUploaded,
  showTitle = false,
  showCategory = false,
}: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('guidance');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setTitle('');
    setCategory('guidance');
    setDescription('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (showTitle && !title.trim()) {
      setError('Title is required');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(extraFields).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });
      if (showTitle) fd.append('title', title.trim());
      if (showCategory) fd.append('category', category);
      if (description) fd.append('description', description);

      const res = await fetch(uploadEndpoint, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Upload failed');
        return;
      }

      onUploaded();
      handleClose();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Files">
      <div className="space-y-4">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.pptx,.jpg,.jpeg,.png,.mp4"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">PDF, Word, PowerPoint, Images, MP4 — max 50MB</p>
        </div>

        {/* Title (materials) */}
        {showTitle && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3 — Assessment Guide"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        )}

        {/* Category (materials) */}
        {showCategory && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="manual">Manual</option>
              <option value="slides">Slides</option>
              <option value="video">Video</option>
              <option value="guidance">Guidance</option>
              <option value="template">Template</option>
            </select>
          </div>
        )}

        {/* Description (materials) */}
        {showTitle && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes about this material"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button
          onClick={handleClose}
          className="px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
