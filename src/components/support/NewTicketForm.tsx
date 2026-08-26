'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { value: 'SUPPORT_REQUEST', label: 'Support Request' },
  { value: 'BUG_REPORT', label: 'Bug Report' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
  { value: 'BILLING_REQUEST', label: 'Billing Request' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  {
    value: 'CRITICAL',
    label: 'Critical',
    note: 'Use for service outages or security issues only',
  },
];

export default function NewTicketForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    category: 'SUPPORT_REQUEST',
    subject: '',
    description: '',
    priority: 'NORMAL',
    url: '',
    environment: '',
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/customer/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Submission failed.');
        return;
      }

      setSuccess(true);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="alert-banner alert-banner-success text-sm">
        Ticket submitted successfully. Our team will respond during support hours (6:00 PM – 10:00 PM IST).
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="alert-banner alert-banner-error text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Category</label>
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Priority</label>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) => update('priority', e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {form.priority === 'CRITICAL' && (
            <p className="text-xs text-[var(--warning)] mt-1">
              Critical priority is for service outages or active security issues only.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="label">Subject *</label>
        <input
          type="text"
          required
          className="input-field"
          value={form.subject}
          onChange={(e) => update('subject', e.target.value)}
          placeholder="Brief description of your issue"
          maxLength={200}
        />
      </div>

      <div>
        <label className="label">Description *</label>
        <textarea
          required
          rows={5}
          className="input-field"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or relevant context."
        />
      </div>

      <div>
        <label className="label">Relevant URL (optional)</label>
        <input
          type="url"
          className="input-field"
          value={form.url}
          onChange={(e) => update('url', e.target.value)}
          placeholder="https://example.com/relevant-page"
        />
      </div>

      <div>
        <label className="label">Environment / Additional context (optional)</label>
        <input
          type="text"
          className="input-field"
          value={form.environment}
          onChange={(e) => update('environment', e.target.value)}
          placeholder="e.g. Node.js 20, LioranDB SDK v1.2.3"
        />
      </div>

      <button type="submit" disabled={loading || isPending} className="btn-primary">
        {loading ? 'Submitting...' : 'Submit ticket'}
      </button>
    </form>
  );
}
