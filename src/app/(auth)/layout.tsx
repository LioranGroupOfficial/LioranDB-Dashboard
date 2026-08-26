export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <span className="text-xl font-semibold tracking-tight" style={{ color: 'var(--accent)' }}>
            LioranDB
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
