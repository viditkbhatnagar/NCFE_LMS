import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Card from '@/components/ui/Card';
import type { UserRole } from '@/types';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in');

  const user = session.user as { name?: string | null; email?: string | null; role?: UserRole };

  const roleLabel = {
    student: 'Student / Learner',
    assessor: 'Assessor',
    iqa: 'Internal Quality Assurer',
    admin: 'Administrator',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Profile</h1>

      <Card>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{user.name}</h2>
            <p className="text-text-secondary">{user.email}</p>
            <span className="inline-block mt-1 px-3 py-0.5 bg-primary-light text-primary text-xs font-medium rounded-full">
              {roleLabel[user.role || 'student']}
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-medium text-text-secondary mb-4">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted">Full Name</p>
              <p className="text-sm text-text-primary font-medium">{user.name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Email</p>
              <p className="text-sm text-text-primary font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Role</p>
              <p className="text-sm text-text-primary font-medium">{roleLabel[user.role || 'student']}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
