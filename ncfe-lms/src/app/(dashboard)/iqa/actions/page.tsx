import Card from '@/components/ui/Card';

export default function IQAActionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Actions Log</h1>
      <Card>
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-text-primary mb-2">Actions Tracking</h3>
          <p className="text-text-secondary">Monitor assessor responses to IQA action points and track completion status.</p>
        </div>
      </Card>
    </div>
  );
}
