'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [unitForm, setUnitForm] = useState({ unitReference: '', title: '', description: '' });
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [loForm, setLoForm] = useState({ loNumber: '', description: '' });
  const [showLoForm, setShowLoForm] = useState<string | null>(null);
  const [acForm, setAcForm] = useState({ acNumber: '', description: '', evidenceRequirements: '' });
  const [showAcForm, setShowAcForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // G9 — confirm dialog state for inline curriculum-tree deletes
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'unit'; id: string; label: string }
    | { kind: 'lo'; id: string; unitId: string; label: string }
    | { kind: 'ac'; id: string; loId: string; label: string }
    | null
  >(null);
  const [confirmDeleting, setConfirmDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // G10 — CSV import state
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [csvDryRun, setCsvDryRun] = useState<{ units: number; los: number; acs: number; warnings: string[] } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: { units: number; los: number; acs: number }; skipped: { units: number; los: number; acs: number } } | null>(null);
  const [showCsvDialog, setShowCsvDialog] = useState(false);

  const fetchQualification = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/admin/qualifications/${id}`);
      if (!res.ok) {
        setLoadError('The server returned an error. Please try again.');
        return;
      }
      const data = await res.json();
      if (data.success) setQualification(data.data);
    } catch {
      setLoadError('Network error. Check your connection and retry.');
    }
  }, [id]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/admin/units?qualificationId=${id}`);
      if (!res.ok) {
        setLoadError('The server returned an error. Please try again.');
        return;
      }
      const data = await res.json();
      if (data.success) setUnits(data.data);
    } catch {
      setLoadError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refetchAll = useCallback(() => {
    setLoadError(null);
    fetchQualification();
    fetchUnits();
  }, [fetchQualification, fetchUnits]);

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

  const handleDeleteUnit = (unit: Unit) => {
    setConfirmDelete({ kind: 'unit', id: unit._id, label: `${unit.unitReference} – ${unit.title}` });
  };

  const handleDeleteLO = (lo: LearningOutcome, unitId: string) => {
    setConfirmDelete({ kind: 'lo', id: lo._id, unitId, label: `${lo.loNumber}: ${lo.description}` });
  };

  const handleDeleteAC = (ac: AssessmentCriteria, loId: string) => {
    setConfirmDelete({ kind: 'ac', id: ac._id, loId, label: `${ac.acNumber}: ${ac.description}` });
  };

  const performConfirmedDelete = async () => {
    if (!confirmDelete) return;
    setConfirmDeleting(true);
    setError(null);
    try {
      let url: string;
      if (confirmDelete.kind === 'unit') url = `/api/v2/admin/units/${confirmDelete.id}`;
      else if (confirmDelete.kind === 'lo') url = `/api/v2/admin/learning-outcomes/${confirmDelete.id}`;
      else url = `/api/v2/admin/assessment-criteria/${confirmDelete.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.error || `Delete failed (HTTP ${res.status})`);
        return;
      }
      if (confirmDelete.kind === 'unit') fetchUnits();
      else if (confirmDelete.kind === 'lo') fetchLOs(confirmDelete.unitId);
      else fetchACs(confirmDelete.loId);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setConfirmDeleting(false);
    }
  };

  // G10 — CSV curriculum import. Format: "Unit Reference, LO Number, AC Number, Description, [Evidence Requirements]"
  const parseCsv = (text: string): Array<{ unitRef: string; loNum: string; acNum: string; desc: string; evidence: string }> => {
    const out: Array<{ unitRef: string; loNum: string; acNum: string; desc: string; evidence: string }> = [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return out;
    // Skip header if first row looks like one
    const startIdx = /unit\s*reference/i.test(lines[0]) ? 1 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      // simple CSV split: respect quoted commas
      const fields: string[] = [];
      let cur = '';
      let inQ = false;
      for (const c of lines[i]) {
        if (c === '"') { inQ = !inQ; continue; }
        if (c === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
        cur += c;
      }
      fields.push(cur.trim());
      if (fields.length < 4) continue;
      const [unitRef, loNum, acNum, desc, evidence = ''] = fields;
      if (!unitRef || !loNum || !acNum || !desc) continue;
      out.push({ unitRef, loNum, acNum, desc, evidence });
    }
    return out;
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const rows = parseCsv(text);
    const unitSet = new Set(rows.map((r) => r.unitRef));
    const loSet = new Set(rows.map((r) => `${r.unitRef}::${r.loNum}`));
    const warnings: string[] = [];
    if (rows.length === 0) warnings.push('No valid rows detected.');
    setCsvDryRun({ units: unitSet.size, los: loSet.size, acs: rows.length, warnings });
  };

  const submitCsvImport = async () => {
    if (!qualification || !csvText) return;
    setCsvImporting(true);
    try {
      const res = await fetch(`/api/v2/admin/qualifications/${qualification._id}/curriculum/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `Import failed (HTTP ${res.status})`);
        return;
      }
      setCsvResult(data.data);
      fetchUnits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCsvImporting(false);
    }
  };

  const closeCsvDialog = () => {
    setShowCsvDialog(false);
    setCsvText('');
    setCsvDryRun(null);
    setCsvResult(null);
    if (csvFileRef.current) csvFileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses" className="text-sm text-primary hover:underline">&larr; Back to Courses</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{qualification?.title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Code: {qualification?.code} &middot; Level {qualification?.level}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Units */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Units ({units.length})</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCsvDialog(true); setCsvText(''); setCsvDryRun(null); setCsvResult(null); }}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
              title="Bulk-import Units, Learning Outcomes, and Assessment Criteria from CSV"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowUnitForm(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
            >
              Add Unit
            </button>
          </div>
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

        <ListStateBoundary
          loading={loading}
          error={loadError}
          isEmpty={units.length === 0}
          onRetry={refetchAll}
          skeleton={<DefaultListSkeleton rows={4} />}
          emptyContent={
            <EmptyState
              title="No units yet"
              description="Add units, learning outcomes, and assessment criteria to build out the curriculum for this qualification."
              cta={
                <button
                  onClick={() => setShowUnitForm(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90"
                >
                  Add a unit
                </button>
              }
            />
          }
        >
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
                  onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit); }}
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
                          onClick={(e) => { e.stopPropagation(); handleDeleteLO(lo, unit._id); }}
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
                              onClick={() => handleDeleteAC(ac, lo._id)}
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
        </ListStateBoundary>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={
          confirmDelete?.kind === 'unit'
            ? 'Delete this unit?'
            : confirmDelete?.kind === 'lo'
            ? 'Delete this learning outcome?'
            : 'Delete this assessment criterion?'
        }
        message={
          confirmDelete
            ? `${confirmDelete.label}\n\nThis cannot be undone${
                confirmDelete.kind === 'unit'
                  ? ' and any nested learning outcomes / criteria will also be removed'
                  : confirmDelete.kind === 'lo'
                  ? ' and any nested criteria will also be removed'
                  : ''
              }.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={confirmDeleting}
        onConfirm={performConfirmedDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {showCsvDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeCsvDialog} />
          <div className="relative bg-white rounded-[8px] shadow-xl max-w-xl w-full mx-4 p-6 max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold text-gray-900">Import curriculum from CSV</h3>
            <p className="text-xs text-gray-600 mt-1">
              CSV with header row. Columns: <code className="bg-gray-100 px-1 rounded">Unit Reference, LO Number, AC Number, Description, [Evidence Requirements]</code>.
              Existing Units / LOs / ACs are matched by their reference and skipped (deduped).
            </p>
            <div className="mt-4 space-y-3">
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
                className="text-sm"
                aria-label="CSV file"
              />
              <textarea
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setCsvDryRun(null); }}
                placeholder="…or paste CSV content here"
                rows={8}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => {
                  const rows = parseCsv(csvText);
                  const unitSet = new Set(rows.map((r) => r.unitRef));
                  const loSet = new Set(rows.map((r) => `${r.unitRef}::${r.loNum}`));
                  const warnings: string[] = [];
                  if (rows.length === 0) warnings.push('No valid rows detected.');
                  setCsvDryRun({ units: unitSet.size, los: loSet.size, acs: rows.length, warnings });
                }}
                disabled={!csvText}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50 disabled:opacity-50"
              >
                Preview
              </button>

              {csvDryRun && !csvResult && (
                <div className="p-3 rounded-[6px] bg-blue-50 border border-blue-200 text-xs text-blue-800">
                  Will create up to <strong>{csvDryRun.units}</strong> units, <strong>{csvDryRun.los}</strong> learning outcomes, <strong>{csvDryRun.acs}</strong> assessment criteria.
                  {csvDryRun.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4">
                      {csvDryRun.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {csvResult && (
                <div className="p-3 rounded-[6px] bg-green-50 border border-green-200 text-xs text-green-800">
                  Created <strong>{csvResult.created.units}</strong> units / <strong>{csvResult.created.los}</strong> LOs / <strong>{csvResult.created.acs}</strong> ACs.
                  Skipped (already existed) <strong>{csvResult.skipped.units}</strong> / <strong>{csvResult.skipped.los}</strong> / <strong>{csvResult.skipped.acs}</strong>.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={closeCsvDialog}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-[6px]"
              >
                Close
              </button>
              {!csvResult && (
                <button
                  onClick={submitCsvImport}
                  disabled={!csvDryRun || csvDryRun.acs === 0 || csvImporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-[6px] hover:bg-primary/90 disabled:opacity-50"
                >
                  {csvImporting ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
