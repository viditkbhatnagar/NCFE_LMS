import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Qualification from '@/models/Qualification';
import Enrolment from '@/models/Enrolment';
import { AssessorCourseProvider } from '@/contexts/AssessorCourseContext';
import AssessorSubHeader from '@/components/assessor/AssessorSubHeader';
import type { UserRole } from '@/types';

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function CourseLayout({ children, params }: Props) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  const user = session.user as { id?: string; role?: UserRole; name?: string | null };

  if (user.role !== 'assessor') {
    redirect('/dashboard');
  }

  await dbConnect();

  const qualification = await Qualification.findOne({ slug }).lean();

  if (!qualification) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Not Found</h2>
          <p className="text-gray-500">The course you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  const enrollments = await Enrolment.find({
    assessorId: user.id,
    qualificationId: qualification._id,
  })
    .populate('userId', 'name email')
    .lean();

  const serializedQualification = {
    _id: qualification._id.toString(),
    title: qualification.title,
    slug: qualification.slug,
    code: qualification.code,
    level: qualification.level,
  };

  const serializedEnrollments = enrollments.map((e: any) => ({
    _id: e._id.toString(),
    userId: {
      _id: e.userId._id.toString(),
      name: e.userId.name,
      email: e.userId.email,
    },
    status: e.status,
    cohortId: e.cohortId || '',
  }));

  return (
    <AssessorCourseProvider
      qualification={serializedQualification}
      enrollments={serializedEnrollments}
    >
      <AssessorSubHeader />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </AssessorCourseProvider>
  );
}
