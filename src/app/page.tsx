import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!user.emailVerified) {
    redirect('/verify-email');
  }

  if (user.role === 'admin') {
    redirect('/admin');
  }

  if (user.role === 'support') {
    redirect('/support-console');
  }

  redirect('/dashboard');
}

