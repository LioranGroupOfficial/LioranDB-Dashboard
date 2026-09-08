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
      <button onClick={() => setOpen(true)} className="btn-primary text-xs px-4 py-2">
        Provision Database →
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg space-y-4 p-5 sm:p-6" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)] text-base">Provision Managed Database</h3>
                <p className="text-xs text-[var(--text-secondary)]">For {customer.name} ({customer.email})</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--surface-2)]"
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

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="label">Host</label>
                  <input
                    type="text"
                    required
                    className="input-field font-mono"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Port</label>
                  <input
                    type="number"
                    required
                    className="input-field font-mono"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Database Name</label>
                  <input
                    type="text"
                    required
                    className="input-field font-mono"
                    value={form.databaseName}
                    onChange={(e) => setForm({ ...form, databaseName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Admin Username</label>
                  <input
                    type="text"
                    required
                    className="input-field font-mono"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Temporary Admin Password (optional — auto-generated if blank)</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="Leave blank to auto-generate secure password"
                  value={form.temporaryPassword}
                  onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Temporary Credential Expiration (days)</label>
                <select
                  className="input-field"
                  value={form.expiresInDays}
                  onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days (recommended)</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>

              <div className="alert-banner alert-banner-info text-xs">
                Provisioning will create the database record, encrypt the connection URI, send the welcome email with credentials to the customer, and set their status to <strong>ACTIVE</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {loading ? 'Deploying...' : 'Deploy & Activate Cluster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

