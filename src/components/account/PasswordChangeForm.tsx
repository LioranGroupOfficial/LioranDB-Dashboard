'use client';

import { useState } from 'react';

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setMsg({ text: 'New passwords do not match', error: true });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/customer/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to update password', error: true });
      } else {
        setMsg({ text: 'Password updated successfully', error: false });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch {
      setMsg({ text: 'An unexpected error occurred', error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {msg && (
        <div className={`alert-banner ${msg.error ? 'alert-banner-error' : 'alert-banner-success'} text-sm`}>
          {msg.text}
        </div>
      )}

      <div>
        <label className="label">Current password</label>
        <input
          type="password"
          required
          className="input-field"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="label">New password</label>
        <input
          type="password"
          required
          className="input-field"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Minimum 10 characters with uppercase, lowercase, digit, and special character.
        </p>
      </div>

      <div>
        <label className="label">Confirm new password</label>
        <input
          type="password"
          required
          className="input-field"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
        />
      </div>

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? 'Updating...' : 'Update password'}
      </button>
    </form>
  );
}

