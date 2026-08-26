export default function AdminHeader({ email }: { email: string }) {
  return (
    <header
      className="h-14 border-b flex items-center justify-between px-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm font-medium text-[var(--text-secondary)]">Admin Panel</p>
      <p className="text-sm text-[var(--text-muted)]">{email}</p>
    </header>
  );
}
