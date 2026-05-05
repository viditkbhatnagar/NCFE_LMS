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

const ACCEPT_EXTENSIONS = '.pdf,.doc,.docx,.pptx,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.webm,.mkv,.mp3,.wav,.zip';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const [error, setError] = useState('');
  const [evidenceKind, setEvidenceKind] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessRole, setWitnessRole] = useState('');
  const [witnessEmployer, setWitnessEmployer] = useState('');
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessStatement, setWitnessStatement] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = () => {
    setFile(null);
    setLabel('');
    setDescription('');
    setUnitId('');
    setError('');
    setProgress(0);
    setUploadPhase('');
    setEvidenceKind('');
    setWitnessName('');
    setWitnessRole('');
    setWitnessEmployer('');
    setWitnessEmail('');
    setWitnessStatement('');
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const uploadToS3WithProgress = (presignedUrl: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
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
    setProgress(0);

    try {
      // Step 1: Get presigned URL
      setUploadPhase('Preparing upload...');
      const presignRes = await fetch('/api/v2/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });
      const presignJson = await presignRes.json();

      if (!presignJson.success) {
        setError(presignJson.error || 'Failed to prepare upload');
        return;
      }

      const { presignedUrl, storageKey, storageBucket } = presignJson.data;

      // Step 2: Upload directly to S3
      setUploadPhase('Uploading file...');
      await uploadToS3WithProgress(presignedUrl, file);

      // Step 3: Save metadata
      setUploadPhase('Saving...');
      setProgress(100);
      const fd = new FormData();
      fd.append('enrolmentId', enrollmentId);
      fd.append('label', label.trim());
      fd.append('description', description);
      if (unitId) fd.append('unitId', unitId);
      fd.append('storageKey', storageKey);
      fd.append('storageBucket', storageBucket);
      fd.append('fileName', file.name);
      fd.append('fileType', file.type);
      fd.append('fileSize', String(file.size));
      if (evidenceKind) fd.append('evidenceKind', evidenceKind);
      if (evidenceKind === 'witness_testimony') {
        if (witnessName) fd.append('witnessName', witnessName);
        if (witnessRole) fd.append('witnessRole', witnessRole);
        if (witnessEmployer) fd.append('witnessEmployer', witnessEmployer);
        if (witnessEmail) fd.append('witnessEmail', witnessEmail);
        if (witnessStatement) fd.append('witnessStatement', witnessStatement);
      }

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
    } catch (err) {
      if (err instanceof Error && err.message === 'Upload cancelled') return;
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      xhrRef.current = null;
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
            accept={ACCEPT_EXTENSIONS}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            PDF, Word, Images, Videos, Audio, ZIP — max 2GB
          </p>
          {file && (
            <p className="text-xs text-gray-500 mt-1">
              Selected: {file.name} ({formatFileSize(file.size)})
            </p>
          )}
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
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30"
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
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">— Not linked to a unit —</option>
            {units.map((u) => (
              <option key={u._id} value={u._id}>
                {u.unitReference} · {u.title}
              </option>
            ))}
          </select>
        </div>

        {/* Evidence kind (G12) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Evidence kind (optional)
          </label>
          <select
            value={evidenceKind}
            onChange={(e) => setEvidenceKind(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">— Not specified —</option>
            <option value="observation">Observation</option>
            <option value="professional_discussion">Professional discussion</option>
            <option value="reflective_account">Reflective account</option>
            <option value="verbal_assessment">Verbal assessment</option>
            <option value="written_assessment">Written assessment</option>
            <option value="work_product">Work product</option>
            <option value="witness_testimony">Witness testimony</option>
          </select>
        </div>

        {/* Witness fields — shown only when kind = witness_testimony (G12) */}
        {evidenceKind === 'witness_testimony' && (
          <div className="space-y-3 p-3 rounded-md bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-900">Witness details</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={witnessName}
                onChange={(e) => setWitnessName(e.target.value)}
                placeholder="Witness name"
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <input
                type="text"
                value={witnessRole}
                onChange={(e) => setWitnessRole(e.target.value)}
                placeholder="Role / job title"
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <input
                type="text"
                value={witnessEmployer}
                onChange={(e) => setWitnessEmployer(e.target.value)}
                placeholder="Employer / organisation"
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <input
                type="email"
                value={witnessEmail}
                onChange={(e) => setWitnessEmail(e.target.value)}
                placeholder="Witness email"
                className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <textarea
              value={witnessStatement}
              onChange={(e) => setWitnessStatement(e.target.value)}
              rows={3}
              placeholder="Witness statement (what they observed)"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{uploadPhase}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
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
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
