import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { UserRole } from '@/types';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/sign-in');

  const role = (session.user as { role?: UserRole }).role || 'student';

  // Redirect assessors and students to the new BRITEthink dashboard
  if (role === 'assessor' || role === 'student') {
    redirect('/c');
  }

  const name = session.user.name || 'User';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {name}
        </h1>
        <p className="text-text-secondary mt-1">
          Here&apos;s an overview of your {role === 'iqa' ? 'quality assurance' : 'admin'} activity
        </p>
      </div>

      {role === 'iqa' && <IQADashboardContent />}
    </div>
  );
}

function StudentDashboardContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardCard title="Enrolled Courses" value="1" subtitle="In progress" color="bg-primary" />
      <DashboardCard title="Evidence Uploaded" value="0" subtitle="Across all units" color="bg-info" />
      <DashboardCard title="Units Completed" value="0/3" subtitle="Mandatory units" color="bg-warning" />
      <DashboardCard title="Overall Progress" value="0%" subtitle="Qualification completion" color="bg-success" />
    </div>
  );
}

function IQADashboardContent() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardCard title="Awaiting Sampling" value="0" subtitle="Units to review" color="bg-primary" />
      <DashboardCard title="Assigned Assessors" value="0" subtitle="Under monitoring" color="bg-info" />
      <DashboardCard title="Open Actions" value="0" subtitle="Pending follow-up" color="bg-warning" />
      <DashboardCard title="EQA Readiness" value="--" subtitle="Not yet calculated" color="bg-secondary" />
    </div>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-[8px] shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        <div className={`w-2 h-2 rounded-full ${color}`} />
      </div>
      <p className="text-3xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-muted mt-1">{subtitle}</p>
    </div>
  );
}
