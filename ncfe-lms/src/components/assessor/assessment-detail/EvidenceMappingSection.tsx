'use client';

import { useState } from 'react';
import EvidenceSelectionModal from '@/components/assessor/EvidenceSelectionModal';
import type { EvidenceMapEntry } from '@/types';

interface EvidenceMappingSectionProps {
  assessmentId: string;
  enrollmentId: string;
  evidenceMap: EvidenceMapEntry[];
  onUpdated: () => void;
}

export default function EvidenceMappingSection({
  assessmentId,
  enrollmentId,
  evidenceMap,
  onUpdated,
}: EvidenceMappingSectionProps) {
  const [showModal, setShowModal] = useState(false);

  const currentEvidenceIds = evidenceMap.map((m) => m.evidenceId._id);

  const handleRemove = async (evidenceIdToRemove: string) => {
    const newIds = currentEvidenceIds.filter((id) => id !== evidenceIdToRemove);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/evidence-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceIds: newIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        onUpdated();
      } else {
        console.error('Error removing evidence:', json.error);
      }
    } catch (err) {
      console.error('Error removing evidence:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Evidence Mapping
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          + Add Evidence
        </button>
      </div>

      {evidenceMap.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-gray-400">
          <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-xs">No attached evidence</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Attached Evidence ({evidenceMap.length})
          </p>
          {evidenceMap.map((item) => (
            <div
              key={item._id}
              className="flex items-center gap-2 p-2 rounded-[6px] border border-gray-200 bg-gray-50"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {item.evidenceId.label || item.evidenceId.fileName}
                </p>
                <p className="text-xs text-gray-500 truncate">{item.evidenceId.fileType}</p>
              </div>
              <button
                onClick={() => handleRemove(item.evidenceId._id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                title="Remove"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <EvidenceSelectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        assessmentId={assessmentId}
        enrollmentId={enrollmentId}
        currentEvidenceIds={currentEvidenceIds}
        onSaved={() => {
          setShowModal(false);
          onUpdated();
        }}
      />
    </div>
  );
}
