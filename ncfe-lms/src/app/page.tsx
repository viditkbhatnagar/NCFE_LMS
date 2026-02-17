import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { UserRole } from '@/types';

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    const role = (session.user as { role?: UserRole }).role;
    if (role === 'assessor') {
      redirect('/c');
    }
    redirect('/dashboard');
  } else {
    redirect('/sign-in');
  }
}
