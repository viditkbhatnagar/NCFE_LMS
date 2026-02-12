'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Material {
  _id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  category: string;
  unitId?: { _id: string; unitReference: string; title: string };
  createdAt: string;
}

export default function CourseMaterialsPage() {
  const { id } = useParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchMaterials() {
      try {
        const res = await fetch(`/api/materials/${id}`);
        const data = await res.json();
        if (data.success) setMaterials(data.data);
      } catch (error) {
        console.error('Failed to fetch materials:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchMaterials();
  }, [id]);

  const categories = ['all', 'manual', 'slides', 'video', 'guidance', 'template'];
  const filtered = filter === 'all' ? materials : materials.filter((m) => m.category === filter);

  const fileTypeIcons: Record<string, string> = {
    pdf: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    pptx: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    template: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z',
  };

  const categoryColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    manual: 'info',
    slides: 'warning',
    video: 'error',
    guidance: 'success',
    template: 'default',
  };

  return (
    <div>
      <Link href={`/courses/${id}`} className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Course
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Learning Materials</h1>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-sm rounded-[6px] font-medium capitalize transition-colors ${
              filter === cat
                ? 'bg-primary text-white'
                : 'bg-white text-text-secondary border border-border hover:bg-background'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">
            {filter === 'all' ? 'No materials available for this course yet.' : `No ${filter} materials found.`}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((material) => (
            <Card key={material._id}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-[6px] flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={fileTypeIcons[material.fileType] || fileTypeIcons.pdf}
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-text-primary truncate">{material.title}</h3>
                    <Badge variant={categoryColors[material.category] || 'default'}>
                      {material.category}
                    </Badge>
                  </div>
                  {material.description && (
                    <p className="text-xs text-text-secondary mb-2 line-clamp-2">{material.description}</p>
                  )}
                  {material.unitId && (
                    <p className="text-xs text-text-muted mb-2">
                      {material.unitId.unitReference}: {material.unitId.title}
                    </p>
                  )}
                  <a
                    href={material.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-primary hover:underline"
                  >
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
