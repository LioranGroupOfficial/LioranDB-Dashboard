'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  KeyRound,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  X,
  ShieldAlert,
} from 'lucide-react';

interface DatabaseUser {
  username: string;
  createdAt: string | Date;
}

interface Props {
  instanceId: string;
  initialUsers: DatabaseUser[];
  instanceStatus: string;
}

export default function DatabaseUsersManager({
  instanceId,
  initialUsers,
  instanceStatus,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<DatabaseUser[]>(initialUsers);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // One-time password display modal
  const [oneTimeSecret, setOneTimeSecret] = useState<{
    username: string;
    password: string;
    title: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const handleCopySecret = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsername.trim();
    if (!username) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/instances/${instanceId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create database user');
      }

      setShowCreateModal(false);
      setNewUsername('');
      setUsers((prev) => [...prev, { username, createdAt: new Date().toISOString() }]);

      // Display one-time password modal
      setOneTimeSecret({
        username,
        password: data.generatedPassword,
        title: 'New Database User Created',
      });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (username: string) => {
    if (!confirm(`Are you sure you want to generate a new password for database user "${username}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/users/${encodeURIComponent(username)}`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setOneTimeSecret({
        username,
        password: data.generatedPassword,
        title: 'Database User Password Reset',
      });
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/users/${encodeURIComponent(userToDelete)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.username !== userToDelete));
      setUserToDelete(null);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeletingUser(false);
    }
  };

  const isActive = instanceStatus === 'ACTIVE' || instanceStatus === 'RUNNING';

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-strong)]" />
            <span>Database Users &amp; Access Control</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage authorized database credentials. Passwords are never stored in plaintext and are shown only once upon generation.
          </p>
        </div>

        {isActive && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Database User</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="border border-[var(--border)] rounded-[7px] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--surface-soft)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-mono">
            <tr>
              <th className="py-2.5 px-4 font-medium">Username</th>
              <th className="py-2.5 px-4 font-medium">Created Date</th>
              <th className="py-2.5 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] font-mono">
            {users.map((u) => (
              <tr key={u.username} className="hover:bg-[var(--surface-soft)] transition-colors">
                <td className="py-2.5 px-4 font-semibold text-[var(--text-strong)]">
                  {u.username}
                </td>
                <td className="py-2.5 px-4 text-[var(--text-muted)]">
                  {new Date(u.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(u.username)}
                      disabled={loading || !isActive}
                      title="Reset and generate new password"
                      className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Reset Password</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserToDelete(u.username)}
                      disabled={loading || !isActive}
                      title="Delete user"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-xs font-sans text-[var(--text-muted)]">
                  No database users configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-strong)]">
                Create Database User
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="label mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. app_backend_user"
                  required
                  className="input-field font-mono text-xs"
                />
                <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                  3-24 alphanumeric characters or underscores.
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-strong)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newUsername.trim()}
                  className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Generate Password &amp; Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME PASSWORD DISPLAY MODAL */}
      {oneTimeSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[7px] bg-[var(--surface-soft)] text-[var(--text-strong)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[var(--text-strong)]">
                  {oneTimeSecret.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  User: <strong className="font-mono text-[var(--text-strong)]">{oneTimeSecret.username}</strong>
                </p>
              </div>
            </div>

            {/* Crucial Security Notice */}
            <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[var(--text-strong)] shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold text-[var(--text-strong)]">Copy this password now. You won&apos;t be able to view it again.</strong>
                <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">
                  For your security, database passwords are never saved in recoverable plaintext on our servers.
                </p>
              </div>
            </div>

            {/* Password Box */}
            <div className="space-y-1.5">
              <label className="label">
                Generated Password
              </label>
              <div className="flex items-center gap-2 p-3 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] font-mono text-sm text-[var(--text-strong)] break-all select-all font-bold">
                <span className="flex-1">{oneTimeSecret.password}</span>
                <button
                  type="button"
                  onClick={() => handleCopySecret(oneTimeSecret.password)}
                  className="btn-secondary text-xs py-1 px-3 shrink-0 inline-flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--text-strong)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setOneTimeSecret(null)}
                className="btn-primary text-xs py-2 px-6"
              >
                I have saved this password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[var(--text-strong)] font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Delete Database User</span>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Are you sure you want to permanently delete user <strong className="font-mono text-[var(--text-strong)]">&ldquo;{userToDelete}&rdquo;</strong>? Applications authenticating with these credentials will lose access immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deletingUser}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {deletingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
