'use client';

import { useState } from 'react';

interface Props {
  initialData: {
    email: string;
    role: string;
    profile: {
      fullName: string;
      company: string;
      phone: string;
      country: string;
    };
  };
}

export default function AccountSettingsForm({ initialData }: Props) {
  const [profile, setProfile] = useState(initialData.profile);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/customer/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to update profile', error: true });
      } else {
        setMsg({ text: 'Profile updated successfully', error: false });
      }
    } catch {
      setMsg({ text: 'An unexpected error occurred', error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && (
        <div className={`alert-banner ${msg.error ? 'alert-banner-error' : 'alert-banner-success'} text-sm`}>
          {msg.text}
        </div>
      )}

      <div>
        <label className="label">Email address</label>
        <input type="email" disabled value={initialData.email} className="input-field opacity-60 cursor-not-allowed" />
        <p className="text-xs text-[var(--text-muted)] mt-1">Contact support to change your account email.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Full name</label>
          <input
            type="text"
            className="input-field"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Company / Organization</label>
          <input
            type="text"
            className="input-field"
            value={profile.company}
            onChange={(e) => setProfile({ ...profile, company: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            className="input-field"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Country</label>
          <input
            type="text"
            className="input-field"
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}

