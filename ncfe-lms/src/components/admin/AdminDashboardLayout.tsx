'use client';

import AdminSidebar from './AdminSidebar';
import TopBar from '../layout/TopBar';

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
  userName: string;
}

export default function AdminDashboardLayout({ children, userName }: AdminDashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar userName={userName} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar userName={userName} />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
