'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

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
  children: ReactNode;
}

export function AssessorCourseProvider({ qualification, enrollments, children }: ProviderProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialEnrollmentId =
    searchParams.get('currentEnrollmentId') ||
    (enrollments.length > 0 ? enrollments[0]._id : null);

  const [currentEnrollmentId, setCurrentEnrollmentIdState] = useState<string | null>(initialEnrollmentId);

  const selectedLearner = enrollments.find((e) => e._id === currentEnrollmentId)?.userId || null;

  const setCurrentEnrollmentId = (id: string) => {
    setCurrentEnrollmentIdState(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('currentEnrollmentId', id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (!currentEnrollmentId && enrollments.length > 0) {
      setCurrentEnrollmentIdState(enrollments[0]._id);
    }
  }, [enrollments, currentEnrollmentId]);

  return (
    <AssessorCourseContext.Provider
      value={{
        qualification,
        enrollments,
        currentEnrollmentId,
        selectedLearner,
        setCurrentEnrollmentId,
      }}
    >
      {children}
    </AssessorCourseContext.Provider>
  );
}
