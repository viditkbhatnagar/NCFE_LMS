'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface UserDetail {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  centreId?: { name?: string } | null;
  createdAt?: string;
}

interface EnrolmentRow {
  _id: string;
  status: string;
  cohortId?: string;
  enrolledAt?: string;
  qualificationId?: { _id: string; title: string; code?: string } | null;
  assessorId?: { _id: string; name: string; email: string } | null;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<EnrolmentRow | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [uRes, eRes] = await Promise.all([
        fetch(`/api/v2/admin/users/${userId}`),
        fetch(`/api/v2/admin/enrolments?userId=${userId}&limit=100`),
      ]);
      if (!uRes.ok) {
        setError(`User load failed (${uRes.status})`);
        return;
      }
      const uData = await uRes.json();
      const eData = await eRes.json().catch(() => ({ success: false, data: [] }));
      setUser(uData.data);
      // The enrolments endpoint may or may not filter by userId server-side; filter defensively.
      const rows = (eData?.data ?? []) as EnrolmentRow[];
      const filtered = rows.filter(
        (r) => !r.qualificationId || (r as unknown as { userId?: { _id?: string } | string }).userId !== undefined,
      );
      setEnrolments(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/v2/admin/enrolments/${withdrawTarget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (res.ok) {
        setWithdrawTarget(null);
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Withdraw failed (${res.status})`);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/users')} className="text-sm text-primary hover:underline">
          ← Back to users
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-[8px] border border-gray-200 p-6 animate-pulse">
          <div className="h-5 w-1/3 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-1/2 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-[6px] p-3 text-sm text-red-700">{error}</div>
      )}

      {user && !loading && (
        <>
          <div className="bg-white rounded-[8px] border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-sm text-gray-600">{user.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{user.role}</span>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user.status}
                  </span>
                  {user.phone && <span className="text-xs text-gray-500">📞 {user.phone}</span>}
                  {user.centreId?.name && <span className="text-xs text-gray-500">🏛 {user.centreId.name}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2 text-right text-xs text-gray-500">
                {user.createdAt && <span>Created {new Date(user.createdAt).toLocaleDateString()}</span>}
                <Link href="/admin/users" className="text-primary hover:underline">Edit on users page</Link>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[8px] border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Enrolments
                <span className="ml-2 text-sm text-gray-500 font-normal">({enrolments.length})</span>
              </h2>
              {user.role === 'student' && (
                <Link
                  href={`/admin/enrolments?userId=${user._id}`}
                  className="text-sm text-primary hover:underline"
                >
                  + Add enrolment
                </Link>
              )}
            </div>

            {enrolments.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                </svg>
                <p>No enrolments yet.</p>
                {user.role === 'student' && (
                  <Link href="/admin/enrolments" className="inline-block mt-2 text-primary hover:underline text-xs">
                    Enrol this student in a course →
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {enrolments.map((e) => (
                  <div key={e._id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {e.qualificationId?.title ?? 'Unknown qualification'}
                        {e.qualificationId?.code && (
                          <span className="ml-2 text-xs text-gray-500">{e.qualificationId.code}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {e.assessorId?.name && <span>Assessor: {e.assessorId.name}</span>}
                        {e.cohortId && <span className="ml-3">Cohort: {e.cohortId}</span>}
                        {e.enrolledAt && (
                          <span className="ml-3">Enrolled {new Date(e.enrolledAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        e.status === 'completed' ? 'bg-green-100 text-green-700' :
                        e.status === 'withdrawn' ? 'bg-gray-100 text-gray-600' :
                        e.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {e.status}
                      </span>
                      {e.status !== 'withdrawn' && (
                        <button
                          onClick={() => setWithdrawTarget(e)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!withdrawTarget}
        title="Withdraw enrolment?"
        message={
          withdrawTarget
            ? `Mark this enrolment in ${withdrawTarget.qualificationId?.title ?? 'this course'} as withdrawn? The learner will lose access to the course but the data is preserved.`
            : ''
        }
        confirmLabel="Withdraw"
        destructive
        loading={withdrawing}
        onConfirm={onWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </div>
  );
}
