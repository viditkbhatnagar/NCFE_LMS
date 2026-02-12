'use client';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { UserRole } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
}

export default function DashboardLayout({ children, role, userName }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} userName={userName} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar userName={userName} />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
