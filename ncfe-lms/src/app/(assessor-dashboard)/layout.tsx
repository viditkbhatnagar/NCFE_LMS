import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AssessorDashboardShell from '@/components/assessor/AssessorDashboardShell';
import type { UserRole } from '@/types';

export default async function AssessorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user as { name?: string | null; role?: UserRole; id?: string };

  if (user.role !== 'assessor' && user.role !== 'student') {
    redirect('/dashboard');
  }

  return (
    <AssessorDashboardShell userName={user.name || 'User'} userRole={user.role || 'student'}>
      {children}
    </AssessorDashboardShell>
  );
}
