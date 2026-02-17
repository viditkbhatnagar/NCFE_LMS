'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';

interface EvidenceItem {
  _id: string;
  fileName: string;
  fileType: string;
  label: string;
  description: string;
  status: string;
}

interface PortfolioUnit {
  unit: { _id: string; unitReference: string; title: string };
  evidence: EvidenceItem[];
}

interface EvidenceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  enrollmentId: string;
  currentEvidenceIds: string[];
  onSaved: () => void;
}

export default function EvidenceSelectionModal({
  isOpen,
  onClose,
  assessmentId,
  enrollmentId,
  currentEvidenceIds,
  onSaved,
}: EvidenceSelectionModalProps) {
  const [allEvidence, setAllEvidence] = useState<(EvidenceItem & { unitName: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    setSelectedIds(new Set(currentEvidenceIds));

    const fetchEvidence = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/portfolio/${enrollmentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success) {
          const flattened = json.data.portfolio.flatMap((p: PortfolioUnit) =>
            p.evidence.map((e: EvidenceItem) => ({
              ...e,
              unitName: `${p.unit.unitReference} - ${p.unit.title}`,
            }))
          );
          setAllEvidence(flattened);
        }
      } catch (err) {
        console.error('Error fetching evidence:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvidence();
  }, [isOpen, enrollmentId, currentEvidenceIds]);

  const toggleEvidence = (evidenceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/evidence-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceIds: [...selectedIds] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        console.error('Error saving evidence mapping:', json.error);
      }
    } catch (err) {
      console.error('Error saving evidence mapping:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Evidence" size="lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allEvidence.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-gray-400">
          <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No evidence available for this learner</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {allEvidence.map((evidence) => {
            const isChecked = selectedIds.has(evidence._id);
            return (
              <button
                key={evidence._id}
                onClick={() => toggleEvidence(evidence._id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] transition-colors text-left ${
                  isChecked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* File icon */}
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {evidence.label || evidence.fileName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{evidence.unitName}</p>
                </div>

                {/* Status */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    evidence.status === 'assessed'
                      ? 'bg-green-50 text-green-700'
                      : evidence.status === 'submitted'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {evidence.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {selectedIds.size} evidence selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[6px] text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
