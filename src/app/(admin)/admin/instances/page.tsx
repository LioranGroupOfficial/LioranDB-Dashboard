import { redirect } from 'next/navigation';

export default function AdminInstancesPage() {
  redirect('/admin/databases');
}
