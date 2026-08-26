'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Customer {
  id: string;
  email: string;
  name: string;
  company: string;
}

export default function ProvisionModal({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanName = customer.company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
  const [form, setForm] = useState({
    customerId: customer.id,
    name: `${customer.company} Production DB`,
    host: `${cleanName}.managed.liorandb.com`,
    port: '27017',
    databaseName: cleanName,
    username: `${cleanName}_admin`,
    temporaryPassword: '',
    expiresInDays: '7',
  });

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          name: form.name,
          host: form.host,
          port: Number(form.port) || 27017,
          databaseName: form.databaseName,
          username: form.username,
          temporaryPassword: form.temporaryPassword || undefined,
          expiresInDays: Number(form.expiresInDays) || 7,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Provisioning failed.');
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-xs px-3 py-1.5">
        Provision Database →
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg space-y-4" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Provision Managed Database</h3>
                <p className="text-xs text-[var(--text-secondary)]">For {customer.name} ({customer.email})</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="alert-banner alert-banner-error text-xs" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-3 text-xs">
              <div>
                <label className="label">Deployment Display Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Host Domain</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Database Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.databaseName}
                    onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Admin Username</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Custom Password (leave blank to auto-generate 24-char secure)</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Auto-generated secure random string"
                  value={form.temporaryPassword}
                  onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Temporary Credential Expiry (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  className="input-field"
                  value={form.expiresInDays}
                  onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                />
              </div>

              <div className="alert-banner alert-banner-info text-xs">
                The connection URI will be AES-256-GCM encrypted in the database. Customer onboarding stage will transition to ACTIVE and an email with details will be sent.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Provisioning...' : 'Confirm & Deploy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

