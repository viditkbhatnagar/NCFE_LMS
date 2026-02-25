import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import type { UserRole } from '@/types';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user as { name?: string | null; role?: UserRole };

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <AdminDashboardLayout userName={user.name || 'Admin'}>
      {children}
    </AdminDashboardLayout>
  );
}
