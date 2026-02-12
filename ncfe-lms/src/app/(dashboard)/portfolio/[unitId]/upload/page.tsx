'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface AC {
  _id: string;
  acNumber: string;
  description: string;
  loNumber: string;
}

export default function UploadEvidencePage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [enrolmentId, setEnrolmentId] = useState('');
  const [availableACs, setAvailableACs] = useState<AC[]>([]);
  const [selectedACs, setSelectedACs] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get enrolment
        const enrolRes = await fetch('/api/enrolments');
        const enrolData = await enrolRes.json();
        if (enrolData.success && enrolData.data.length > 0) {
          setEnrolmentId(enrolData.data[0]._id);
        }

        // Get unit ACs
        const unitRes = await fetch(`/api/units/${params.unitId}`);
        const unitData = await unitRes.json();
        if (unitData.success) {
          const acs: AC[] = [];
          for (const lo of unitData.data.learningOutcomes) {
            for (const ac of lo.assessmentCriteria) {
              acs.push({
                _id: ac._id,
                acNumber: ac.acNumber,
                description: ac.description,
                loNumber: lo.loNumber,
              });
            }
          }
          setAvailableACs(acs);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }
    fetchData();
  }, [params.unitId]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toggleAC = (acId: string) => {
    setSelectedACs((prev) => {
      const next = new Set(prev);
      if (next.has(acId)) next.delete(acId);
      else next.add(acId);
      return next;
    });
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return; }
    if (!label) { setError('Please enter a label'); return; }
    if (selectedACs.size === 0) { setError('Please select at least one Assessment Criteria'); return; }
    if (!enrolmentId) { setError('No active enrolment found'); return; }

    setError('');
    setUploading(true);

    try {
      // Upload the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('enrolmentId', enrolmentId);
      formData.append('unitId', params.unitId as string);
      formData.append('label', label);
      formData.append('description', description);

      const uploadRes = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setError(uploadData.error || 'Upload failed');
        return;
      }

      // Map to ACs
      const mappingRes = await fetch(`/api/evidence/${uploadData.data._id}/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentCriteriaIds: Array.from(selectedACs) }),
      });

      if (!mappingRes.ok) {
        setError('File uploaded but AC mapping failed');
        return;
      }

      router.push('/portfolio');
    } catch {
      setError('Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Upload Evidence</h1>
        <p className="text-text-secondary mt-1">Upload your evidence and map it to Assessment Criteria</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[6px] text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">File Upload</h2>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-[8px] p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary-light/30' : 'border-border'
            }`}
          >
            {file ? (
              <div>
                <svg className="w-10 h-10 text-primary mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-text-primary">{file.name}</p>
                <p className="text-xs text-text-muted mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-error hover:underline mt-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <svg className="w-10 h-10 text-text-muted mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm text-text-primary mb-1">Drag and drop your file here, or</p>
                <label className="text-sm text-primary hover:text-primary-dark cursor-pointer font-medium">
                  browse files
                  <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4" />
                </label>
                <p className="text-xs text-text-muted mt-2">PDF, DOC, DOCX, JPG, PNG, MP4 (max 50MB)</p>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <Input
              id="label"
              label="Evidence Label"
              placeholder="e.g., Unit 301 - AC 1.1 - Assessment Principles Essay"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Description (optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-[6px] text-sm text-text-primary bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                placeholder="Brief description of this evidence"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* AC Mapping Section */}
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Map to Assessment Criteria</h2>
          <p className="text-sm text-text-secondary mb-4">
            Select the ACs this evidence covers. At least one is required.
          </p>

          {selectedACs.size > 0 && (
            <div className="mb-4 p-3 bg-primary-light/30 rounded-[6px]">
              <p className="text-xs font-medium text-primary">
                {selectedACs.size} AC{selectedACs.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availableACs.map((ac) => (
              <label
                key={ac._id}
                className={`flex items-start gap-3 p-3 rounded-[6px] cursor-pointer transition-colors ${
                  selectedACs.has(ac._id) ? 'bg-primary-light/20 border border-primary' : 'border border-border hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedACs.has(ac._id)}
                  onChange={() => toggleAC(ac._id)}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary bg-primary-light px-1.5 py-0.5 rounded">
                      {ac.acNumber}
                    </span>
                    <span className="text-xs text-text-muted">{ac.loNumber}</span>
                  </div>
                  <p className="text-sm text-text-primary mt-1">{ac.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* Submit */}
      <div className="mt-6 flex gap-3">
        <Button onClick={handleUpload} isLoading={uploading} size="lg">
          Upload & Map Evidence
        </Button>
        <Button variant="outline" onClick={() => router.back()} size="lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}
