'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressRing from '@/components/ui/ProgressRing';

interface Learner {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  qualificationId: {
    _id: string;
    title: string;
    level: number;
  };
  status: string;
}

export default function AssessorLearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchLearners() {
      try {
        const res = await fetch('/api/assessor/learners');
        const data = await res.json();
        if (data.success) {
          setLearners(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch learners:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLearners();
  }, []);

  const filtered = learners.filter((l) =>
    l.userId.name.toLowerCase().includes(search.toLowerCase()) ||
    l.userId.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Learners</h1>
        <p className="text-text-secondary mt-1">Manage and assess your assigned learners</p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search learners..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-border rounded-[6px] text-sm bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-text-secondary">No learners assigned yet.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((learner) => (
            <Link key={learner._id} href={`/assessor/learners/${learner.userId._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                      {learner.userId.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{learner.userId.name}</h3>
                      <p className="text-xs text-text-muted">{learner.userId.email}</p>
                    </div>
                  </div>
                  <ProgressRing value={0} size={36} strokeWidth={3} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary line-clamp-1">{learner.qualificationId.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">Level {learner.qualificationId.level}</Badge>
                    <Badge variant={learner.status === 'in_progress' ? 'warning' : 'default'}>
                      {learner.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
