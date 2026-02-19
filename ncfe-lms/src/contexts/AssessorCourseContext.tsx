'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { UserRole } from '@/types';

interface Learner {
  _id: string;
  name: string;
  email: string;
}

interface Enrollment {
  _id: string;
  userId: Learner;
  status: string;
  cohortId: string;
}

interface Qualification {
  _id: string;
  title: string;
  slug: string;
  code: string;
  level: number;
}

interface AssessorCourseContextType {
  qualification: Qualification;
  enrollments: Enrollment[];
  currentEnrollmentId: string | null;
  selectedLearner: Learner | null;
  setCurrentEnrollmentId: (id: string) => void;
  userRole: UserRole;
}

const AssessorCourseContext = createContext<AssessorCourseContextType | null>(null);

export function useAssessorCourse() {
  const ctx = useContext(AssessorCourseContext);
  if (!ctx) {
    throw new Error('useAssessorCourse must be used within AssessorCourseProvider');
  }
  return ctx;
}

/** Safe variant that returns null outside the provider (for components rendered at both /c and /c/[slug]) */
export function useAssessorCourseOptional(): AssessorCourseContextType | null {
  return useContext(AssessorCourseContext);
}

interface ProviderProps {
  qualification: Qualification;
  enrollments: Enrollment[];
  userRole: UserRole;
  children: ReactNode;
}

export function AssessorCourseProvider({ qualification, enrollments, userRole, children }: ProviderProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const paramEnrollmentId = searchParams.get('currentEnrollmentId');
  // Default to null (All Learners) for assessors, first enrollment for students
  const initialEnrollmentId =
    paramEnrollmentId ||
    (userRole === 'student' && enrollments.length > 0 ? enrollments[0]._id : null);

  const [currentEnrollmentId, setCurrentEnrollmentIdState] = useState<string | null>(initialEnrollmentId);

  const selectedLearner = enrollments.find((e) => e._id === currentEnrollmentId)?.userId || null;

  const setCurrentEnrollmentId = (id: string) => {
    const enrollId = id || null; // empty string → null (All Learners)
    setCurrentEnrollmentIdState(enrollId);
    const params = new URLSearchParams(searchParams.toString());
    if (enrollId) {
      params.set('currentEnrollmentId', enrollId);
    } else {
      params.delete('currentEnrollmentId');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    // Only auto-select first enrollment for students (assessors default to "All Learners")
    if (userRole === 'student' && !currentEnrollmentId && enrollments.length > 0) {
      setCurrentEnrollmentIdState(enrollments[0]._id);
    }
  }, [enrollments, currentEnrollmentId, userRole]);

  return (
    <AssessorCourseContext.Provider
      value={{
        qualification,
        enrollments,
        currentEnrollmentId,
        selectedLearner,
        setCurrentEnrollmentId,
        userRole,
      }}
    >
      {children}
    </AssessorCourseContext.Provider>
  );
}
