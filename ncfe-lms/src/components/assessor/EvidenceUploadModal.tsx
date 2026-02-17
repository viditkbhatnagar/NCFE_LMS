'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';

interface Unit {
  _id: string;
  unitReference: string;
  title: string;
}

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: string;
  units: Unit[];
  onUploaded: () => void;
}

export default function EvidenceUploadModal({
  isOpen,
  onClose,
  enrollmentId,
  units,
  onUploaded,
}: EvidenceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setLabel('');
    setDescription('');
    setUnitId('');
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
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('enrolmentId', enrollmentId);
      fd.append('label', label.trim());
      fd.append('description', description);
      if (unitId) fd.append('unitId', unitId);

      const res = await fetch('/api/v2/evidence/upload', {
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Evidence">
      <div className="space-y-4">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            File
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            PDF, Word, Images, MP4 — max 50MB
          </p>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Observation recording — Unit 3"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional notes about this evidence"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit (optional)
          </label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">— Not linked to a unit —</option>
            {units.map((u) => (
              <option key={u._id} value={u._id}>
                {u.unitReference} · {u.title}
              </option>
            ))}
          </select>
        </div>

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
