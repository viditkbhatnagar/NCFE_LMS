import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { UserRole } from '@/types';

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user as { name?: string | null; role?: UserRole };

  return (
    <DashboardLayout
      role={user.role || 'student'}
      userName={user.name || 'User'}
    >
      {children}
    </DashboardLayout>
  );
}
