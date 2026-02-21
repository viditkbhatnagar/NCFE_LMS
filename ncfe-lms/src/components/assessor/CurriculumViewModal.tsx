'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import type { CriteriaTreeUnit } from '@/types';

interface CurriculumViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  qualificationId: string;
}

export default function CurriculumViewModal({
  isOpen,
  onClose,
  qualificationId,
}: CurriculumViewModalProps) {
  const [tree, setTree] = useState<CriteriaTreeUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedLOs, setExpandedLOs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v2/qualifications/${qualificationId}/criteria-tree`);
        const json = await res.json();
        if (json.success) {
          setTree(json.data);
          setExpandedUnits(new Set(json.data.map((u: CriteriaTreeUnit) => u._id)));
        }
      } catch (err) {
        console.error('Error fetching criteria tree:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [isOpen, qualificationId]);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Qualification Curriculum" size="lg">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-brand-600">{totalCriteria}</span> assessment criteria across{' '}
          <span className="font-semibold text-brand-600">{tree.length}</span> units
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
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-600">
                            {lo.loNumber}
                          </span>
                          <span className="text-xs text-gray-700 text-left flex-1 truncate">
                            {lo.description}
                          </span>
                          <span className="text-xs text-gray-400">
                            {lo.assessmentCriteria.length}
                          </span>
                        </button>

                        {isLOExpanded &&
                          lo.assessmentCriteria.map((ac) => (
                            <div
                              key={ac._id}
                              className="flex items-start gap-2 ml-5 px-2 py-1.5"
                            >
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 shrink-0">
                                {ac.acNumber}
                              </span>
                              <span className="text-xs text-gray-600">
                                {ac.description}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-[6px] text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
