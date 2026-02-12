import Card from '@/components/ui/Card';

export default function StandardisationPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Standardisation Records</h1>
      <Card>
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-text-primary mb-2">Standardisation Meetings</h3>
          <p className="text-text-secondary">Record standardisation meetings, upload minutes, and track outcomes. NCFE requires at least 1 standardisation per year per qualification.</p>
        </div>
      </Card>
    </div>
  );
}
