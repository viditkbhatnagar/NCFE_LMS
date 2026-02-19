'use client';

import { useState, type ReactNode } from 'react';
import AssessorTopNav from './AssessorTopNav';
import AssessorIconSidebar from './AssessorIconSidebar';
import FloatingChatButton from './FloatingChatButton';
import type { UserRole } from '@/types';

interface Props {
  userName: string;
  userRole?: UserRole;
  children: ReactNode;
}

export default function AssessorDashboardShell({ userName, userRole = 'assessor', children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AssessorTopNav
        userName={userName}
        userRole={userRole}
        onMenuToggle={() => setSidebarOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <AssessorIconSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userRole={userRole}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
      <FloatingChatButton />
    </div>
  );
}
