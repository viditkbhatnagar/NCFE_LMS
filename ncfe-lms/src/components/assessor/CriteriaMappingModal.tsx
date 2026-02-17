'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import type { CriteriaTreeUnit } from '@/types';

interface CriteriaMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  qualificationId: string;
  currentMappedIds: string[];
  onSaved: () => void;
}

export default function CriteriaMappingModal({
  isOpen,
  onClose,
  assessmentId,
  qualificationId,
  currentMappedIds,
  onSaved,
}: CriteriaMappingModalProps) {
  const [tree, setTree] = useState<CriteriaTreeUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedLOs, setExpandedLOs] = useState<Set<string>>(new Set());

  // Fetch tree and initialize selections when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setSelectedIds(new Set(currentMappedIds));

    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v2/qualifications/${qualificationId}/criteria-tree`);
        const json = await res.json();
        if (json.success) {
          setTree(json.data);
          // Auto-expand all units
          setExpandedUnits(new Set(json.data.map((u: CriteriaTreeUnit) => u._id)));
        }
      } catch (err) {
        console.error('Error fetching criteria tree:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [isOpen, qualificationId, currentMappedIds]);

  const toggleCriteria = (criteriaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(criteriaId)) {
        next.delete(criteriaId);
      } else {
        next.add(criteriaId);
      }
      return next;
    });
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleLO = (loId: string) => {
    setExpandedLOs((prev) => {
      const next = new Set(prev);
      if (next.has(loId)) next.delete(loId);
      else next.add(loId);
      return next;
    });
  };

  const totalCriteria = tree.reduce(
    (sum, u) => sum + u.learningOutcomes.reduce((s, lo) => s + lo.assessmentCriteria.length, 0),
    0
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/criteria-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaIds: [...selectedIds] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        console.error('Error saving criteria mapping:', json.error);
      }
    } catch (err) {
      console.error('Error saving criteria mapping:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criteria Mapping" size="lg">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-blue-600">{selectedIds.size}</span> of{' '}
          {totalCriteria} criteria mapped
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {tree.map((unit) => {
            const isExpanded = expandedUnits.has(unit._id);
            const unitCriteriaCount = unit.learningOutcomes.reduce(
              (s, lo) => s + lo.assessmentCriteria.length,
              0
            );

            return (
              <div key={unit._id}>
                {/* Unit row */}
                <button
                  onClick={() => toggleUnit(unit._id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-[6px] hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {unit.unitReference}
                  </span>
                  <span className="text-sm font-medium text-gray-900 text-left flex-1 truncate">
                    {unit.title}
                  </span>
                  <span className="text-xs text-gray-400">{unitCriteriaCount} criteria</span>
                </button>

                {/* LO rows */}
                {isExpanded &&
                  unit.learningOutcomes.map((lo) => {
                    const isLOExpanded = expandedLOs.has(lo._id);
                    return (
                      <div key={lo._id} className="ml-6">
                        <button
                          onClick={() => toggleLO(lo._id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] hover:bg-gray-50 transition-colors"
                        >
                          <svg
                            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isLOExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                            {lo.loNumber}
                          </span>
                          <span className="text-xs text-gray-700 text-left flex-1 truncate">
                            {lo.description}
                          </span>
                          <span className="text-xs text-gray-400">
                            {lo.assessmentCriteria.length}
                          </span>
                        </button>

                        {/* AC rows */}
                        {isLOExpanded &&
                          lo.assessmentCriteria.map((ac) => {
                            const isChecked = selectedIds.has(ac._id);
                            return (
                              <button
                                key={ac._id}
                                onClick={() => toggleCriteria(ac._id)}
                                className="w-full flex items-center gap-2 ml-5 px-2 py-1.5 rounded-[6px] hover:bg-gray-50 transition-colors"
                              >
                                {/* Checkbox */}
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    isChecked
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {isChecked && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                                  {ac.acNumber}
                                </span>
                                <span className="text-xs text-gray-600 text-left flex-1">
                                  {ac.description}
                                </span>
                                {isChecked && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                                    Mapped
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {selectedIds.size} criteria mapped
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Close'}
        </button>
      </div>
    </Modal>
  );
}
