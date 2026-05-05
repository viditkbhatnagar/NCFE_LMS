import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function ForgotPasswordPage() {
  return (
    <Card padding="lg">
      <div className="text-center">
        <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Contact your administrator</h2>
        <p className="text-sm text-text-secondary mb-6">
          For account security, password resets are handled by your centre administrator. Please email or speak to your administrator and they will issue a new password to you directly.
        </p>
        <Link href="/sign-in">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </Card>
  );
}
