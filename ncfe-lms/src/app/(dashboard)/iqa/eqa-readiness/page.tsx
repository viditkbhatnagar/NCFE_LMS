import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function EQAReadinessPage() {
  const checks = [
    { label: 'Sampling coverage complete', status: 'pending' },
    { label: 'All actions closed', status: 'pending' },
    { label: 'Consistent assessment decisions', status: 'pending' },
    { label: 'Clear audit trail', status: 'pending' },
    { label: 'Centre policies accessible', status: 'pending' },
    { label: 'Standardisation records up to date', status: 'pending' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">EQA Readiness</h1>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Readiness Checklist</h2>
          <Badge variant="warning">Not Ready</Badge>
        </div>
        <div className="space-y-3">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-[6px]">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                check.status === 'complete' ? 'border-primary bg-primary' : 'border-gray-300'
              }`}>
                {check.status === 'complete' && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-text-primary">{check.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Audit Export</h2>
        <p className="text-sm text-text-secondary mb-4">
          Export audit logs for EQA visits. Filter by date range, entity type, and user.
        </p>
        <button className="inline-flex items-center px-4 py-2 border border-border bg-white text-text-primary rounded-[6px] text-sm font-medium hover:bg-background transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Audit Logs
        </button>
      </Card>
    </div>
  );
}
