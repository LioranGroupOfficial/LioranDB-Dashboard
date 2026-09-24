'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface DeleteInstanceButtonProps {
  instanceId: string;
  instanceName: string;
}

export default function DeleteInstanceButton({
  instanceId,
  instanceName,
}: DeleteInstanceButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`/api/instances/${instanceId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete instance.');
      }

      router.push('/database');
      router.refresh();
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : 'Deletion failed';
      setError(errStr);
      setLoading(false);
    }
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-500/30 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Database Instance</span>
        </button>
      ) : (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3 max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Confirm Deletion of &ldquo;{instanceName}&rdquo;</span>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Are you sure you want to terminate this instance? All stored data will be permanently wiped.
          </p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="py-1.5 px-3 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Yes, Terminate Cluster</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="py-1.5 px-3 rounded bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] text-xs font-medium border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

