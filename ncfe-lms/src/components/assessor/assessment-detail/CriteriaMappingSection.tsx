'use client';

import { useState } from 'react';
import CriteriaMappingModal from '@/components/assessor/CriteriaMappingModal';
import type { CriteriaMapEntry } from '@/types';

interface CriteriaMappingSectionProps {
  assessmentId: string;
  qualificationId: string;
  criteriaMap: CriteriaMapEntry[];
  onUpdated: () => void;
}

export default function CriteriaMappingSection({
  assessmentId,
  qualificationId,
  criteriaMap,
  onUpdated,
}: CriteriaMappingSectionProps) {
  const [showModal, setShowModal] = useState(false);

  // Group criteria by unit → LO
  const grouped: Record<string, { unit: { _id: string; unitReference: string; title: string }; los: Record<string, { lo: { loNumber: string; description: string }; criteria: CriteriaMapEntry[] }> }> = {};

  for (const entry of criteriaMap) {
    const unit = entry.criteriaId.unitId;
    const lo = entry.criteriaId.learningOutcomeId;
    const unitKey = unit._id;

    if (!grouped[unitKey]) {
      grouped[unitKey] = { unit, los: {} };
    }
    const loKey = lo._id;
    if (!grouped[unitKey].los[loKey]) {
      grouped[unitKey].los[loKey] = { lo, criteria: [] };
    }
    grouped[unitKey].los[loKey].criteria.push(entry);
  }

  const currentMappedIds = criteriaMap.map((m) => m.criteriaId._id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Criteria Mapping
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
            {criteriaMap.length} mapped
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Edit Mapping
        </button>
      </div>

      {criteriaMap.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-gray-400">
          <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-xs">No criteria mapped</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.values(grouped).map(({ unit, los }) => (
            <div key={unit._id}>
              <p className="text-xs font-semibold text-blue-600 mb-1">
                {unit.unitReference} - {unit.title}
              </p>
              {Object.entries(los).map(([loId, { lo, criteria }]) => (
                <div key={loId} className="ml-3 mb-2">
                  <p className="text-xs text-gray-500 mb-1">{lo.loNumber}: {lo.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {criteria.map((c) => (
                      <span
                        key={c._id}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700"
                      >
                        {c.criteriaId.acNumber}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <CriteriaMappingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        assessmentId={assessmentId}
        qualificationId={qualificationId}
        currentMappedIds={currentMappedIds}
        onSaved={() => {
          setShowModal(false);
          onUpdated();
        }}
      />
    </div>
  );
}
