'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface AssessmentCriteria {
  _id: string;
  acNumber: string;
  description: string;
  evidenceRequirements?: string;
}

interface LearningOutcome {
  _id: string;
  loNumber: string;
  description: string;
}

interface Unit {
  _id: string;
  unitReference: string;
  title: string;
  description: string;
}

interface Qualification {
  _id: string;
  title: string;
  code: string;
  level: number;
  slug: string;
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [los, setLos] = useState<Record<string, LearningOutcome[]>>({});
  const [acs, setAcs] = useState<Record<string, AssessmentCriteria[]>>({});
  const [expandedLo, setExpandedLo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [unitForm, setUnitForm] = useState({ unitReference: '', title: '', description: '' });
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [loForm, setLoForm] = useState({ loNumber: '', description: '' });
  const [showLoForm, setShowLoForm] = useState<string | null>(null);
  const [acForm, setAcForm] = useState({ acNumber: '', description: '', evidenceRequirements: '' });
  const [showAcForm, setShowAcForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchQualification = useCallback(async () => {
    const res = await fetch(`/api/v2/admin/qualifications/${id}`);
    const data = await res.json();
    if (data.success) setQualification(data.data);
  }, [id]);

  const fetchUnits = useCallback(async () => {
    const res = await fetch(`/api/v2/admin/units?qualificationId=${id}`);
    const data = await res.json();
    if (data.success) setUnits(data.data);
    setLoading(false);
  }, [id]);

  const fetchLOs = useCallback(async (unitId: string) => {
    const res = await fetch(`/api/v2/admin/learning-outcomes?unitId=${unitId}`);
    const data = await res.json();
    if (data.success) setLos((prev) => ({ ...prev, [unitId]: data.data }));
  }, []);

  const fetchACs = useCallback(async (loId: string) => {
    const res = await fetch(`/api/v2/admin/assessment-criteria?learningOutcomeId=${loId}`);
    const data = await res.json();
    if (data.success) setAcs((prev) => ({ ...prev, [loId]: data.data }));
  }, []);

  useEffect(() => {
    fetchQualification();
    fetchUnits();
  }, [fetchQualification, fetchUnits]);

  const toggleUnit = (unitId: string) => {
    if (expandedUnit === unitId) {
      setExpandedUnit(null);
    } else {
      setExpandedUnit(unitId);
      if (!los[unitId]) fetchLOs(unitId);
    }
  };

  const toggleLo = (loId: string) => {
    if (expandedLo === loId) {
      setExpandedLo(null);
    } else {
      setExpandedLo(loId);
      if (!acs[loId]) fetchACs(loId);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/v2/admin/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...unitForm, qualificationId: id }),
    });
    const data = await res.json();
    if (data.success) {
      setShowUnitForm(false);
      setUnitForm({ unitReference: '', title: '', description: '' });
      fetchUnits();
    }
    setSaving(false);
  };

  const handleAddLO = async (e: React.FormEvent, unitId: string) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/v2/admin/learning-outcomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...loForm, unitId }),
    });
    const data = await res.json();
    if (data.success) {
      setShowLoForm(null);
      setLoForm({ loNumber: '', description: '' });
      fetchLOs(unitId);
    }
    setSaving(false);
  };

  const handleAddAC = async (e: React.FormEvent, loId: string, unitId: string) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/v2/admin/assessment-criteria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...acForm, learningOutcomeId: loId, unitId, qualificationId: id }),
    });
    const data = await res.json();
    if (data.success) {
      setShowAcForm(null);
      setAcForm({ acNumber: '', description: '', evidenceRequirements: '' });
      fetchACs(loId);
    }
    setSaving(false);
  };

  const handleDeleteUnit = async (unitId: string) => {
    await fetch(`/api/v2/admin/units/${unitId}`, { method: 'DELETE' });
    fetchUnits();
  };

  const handleDeleteLO = async (loId: string, unitId: string) => {
    await fetch(`/api/v2/admin/learning-outcomes/${loId}`, { method: 'DELETE' });
    fetchLOs(unitId);
  };

  const handleDeleteAC = async (acId: string, loId: string) => {
    await fetch(`/api/v2/admin/assessment-criteria/${acId}`, { method: 'DELETE' });
    fetchACs(loId);
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses" className="text-sm text-primary hover:underline">&larr; Back to Courses</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{qualification?.title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Code: {qualification?.code} &middot; Level {qualification?.level}
        </p>
      </div>

      {/* Units */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Units ({units.length})</h2>
          <button
            onClick={() => setShowUnitForm(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
          >
            Add Unit
          </button>
        </div>

        {showUnitForm && (
          <form onSubmit={handleAddUnit} className="bg-white rounded-[8px] border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Unit Reference (e.g. Unit 301)"
                value={unitForm.unitReference}
                onChange={(e) => setUnitForm({ ...unitForm, unitReference: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <input
                placeholder="Unit Title"
                value={unitForm.title}
                onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-[6px] disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Unit'}
              </button>
              <button type="button" onClick={() => setShowUnitForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-[6px]">
                Cancel
              </button>
            </div>
          </form>
        )}

        {units.map((unit) => (
          <div key={unit._id} className="bg-white rounded-[8px] border border-gray-200">
            <button
              onClick={() => toggleUnit(unit._id)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <span className="text-sm font-semibold text-gray-900">{unit.unitReference}</span>
                <span className="text-sm text-gray-600 ml-2">- {unit.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit._id); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedUnit === unit._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedUnit === unit._id && (
              <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase">Learning Outcomes</span>
                  <button
                    onClick={() => setShowLoForm(unit._id)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add LO
                  </button>
                </div>

                {showLoForm === unit._id && (
                  <form onSubmit={(e) => handleAddLO(e, unit._id)} className="flex gap-2 items-end">
                    <input
                      placeholder="LO Number (e.g. LO1)"
                      value={loForm.loNumber}
                      onChange={(e) => setLoForm({ ...loForm, loNumber: e.target.value })}
                      className="px-2 py-1.5 text-xs border border-gray-300 rounded-[6px] w-24"
                    />
                    <input
                      placeholder="Description"
                      value={loForm.description}
                      onChange={(e) => setLoForm({ ...loForm, description: e.target.value })}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-[6px]"
                    />
                    <button type="submit" disabled={saving} className="px-2 py-1.5 text-xs text-white bg-primary rounded-[6px] disabled:opacity-50">Add</button>
                    <button type="button" onClick={() => setShowLoForm(null)} className="px-2 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-[6px]">Cancel</button>
                  </form>
                )}

                {(los[unit._id] || []).map((lo) => (
                  <div key={lo._id} className="ml-4 border-l-2 border-gray-200 pl-3">
                    <button
                      onClick={() => toggleLo(lo._id)}
                      className="w-full flex items-center justify-between text-left py-1"
                    >
                      <span className="text-sm text-gray-800">
                        <strong>{lo.loNumber}</strong> - {lo.description}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLO(lo._id, unit._id); }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                        <svg className={`w-3 h-3 text-gray-400 transition-transform ${expandedLo === lo._id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedLo === lo._id && (
                      <div className="ml-4 mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500 uppercase">Assessment Criteria</span>
                          <button
                            onClick={() => setShowAcForm(lo._id)}
                            className="text-xs text-primary hover:underline"
                          >
                            + Add AC
                          </button>
                        </div>

                        {showAcForm === lo._id && (
                          <form onSubmit={(e) => handleAddAC(e, lo._id, unit._id)} className="flex gap-2 items-end">
                            <input
                              placeholder="AC# (e.g. 1.1)"
                              value={acForm.acNumber}
                              onChange={(e) => setAcForm({ ...acForm, acNumber: e.target.value })}
                              className="px-2 py-1.5 text-xs border border-gray-300 rounded-[6px] w-20"
                            />
                            <input
                              placeholder="Description"
                              value={acForm.description}
                              onChange={(e) => setAcForm({ ...acForm, description: e.target.value })}
                              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-[6px]"
                            />
                            <button type="submit" disabled={saving} className="px-2 py-1.5 text-xs text-white bg-primary rounded-[6px] disabled:opacity-50">Add</button>
                            <button type="button" onClick={() => setShowAcForm(null)} className="px-2 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-[6px]">Cancel</button>
                          </form>
                        )}

                        {(acs[lo._id] || []).map((ac) => (
                          <div key={ac._id} className="flex items-center justify-between py-1 ml-2 border-l border-gray-100 pl-2">
                            <span className="text-xs text-gray-700">
                              <strong>{ac.acNumber}</strong> - {ac.description}
                            </span>
                            <button
                              onClick={() => handleDeleteAC(ac._id, lo._id)}
                              className="text-xs text-red-500 hover:underline shrink-0 ml-2"
                            >
                              Delete
                            </button>
                          </div>
                        ))}

                        {acs[lo._id]?.length === 0 && (
                          <p className="text-xs text-gray-400 ml-2">No assessment criteria yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {los[unit._id]?.length === 0 && (
                  <p className="text-xs text-gray-400 ml-4">No learning outcomes yet.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {units.length === 0 && (
          <div className="bg-white rounded-[8px] border border-gray-200 p-8 text-center text-sm text-gray-400">
            No units added yet. Click "Add Unit" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
