'use client';

import { useState } from 'react';
import type { RemarkEntry } from '@/types';

interface RemarksSectionProps {
  remarks: RemarkEntry[];
  assessmentId: string;
  onAdded: () => void;
}

export default function RemarksSection({ remarks, assessmentId, onAdded }: RemarksSectionProps) {
  const [newRemark, setNewRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newRemark.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newRemark.trim() }),
      });
      if (res.ok) {
        setNewRemark('');
        onAdded();
      }
    } catch (err) {
      console.error('Error adding remark:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Remarks
        </h3>
      </div>

      {/* Existing remarks */}
      {remarks.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No remarks yet</p>
      ) : (
        <div className="space-y-3">
          {remarks.map((remark) => {
            const name = remark.createdBy?.name || 'Unknown';
            const initials = name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div key={remark._id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gray-900">{name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(remark.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{remark.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add remark form */}
      <div className="space-y-2">
        <textarea
          value={newRemark}
          onChange={(e) => setNewRemark(e.target.value)}
          placeholder="Add a remark..."
          rows={2}
          className="w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newRemark.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            'Submitting...'
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit Remark
            </>
          )}
        </button>
      </div>
    </div>
  );
}
