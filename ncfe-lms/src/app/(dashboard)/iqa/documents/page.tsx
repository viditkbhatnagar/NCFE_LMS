import Card from '@/components/ui/Card';

export default function CentreDocumentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Centre Documents</h1>
      <Card>
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h3 className="text-lg font-medium text-text-primary mb-2">Centre Quality File</h3>
          <p className="text-text-secondary">Manage sampling plans, IQA reports, assessor action plans, standardisation minutes, and CPD records.</p>
        </div>
      </Card>
    </div>
  );
}
