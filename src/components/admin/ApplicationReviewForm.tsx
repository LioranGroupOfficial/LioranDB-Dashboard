'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  applicationId: string;
  currentStatus: string;
  initialNotes: string;
  initialRejectionReason: string;
}

export default function ApplicationReviewForm({
  applicationId,
  currentStatus,
  initialNotes,
  initialRejectionReason,
}: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'UNDER_REVIEW'>(
    currentStatus === 'APPROVED' ? 'APPROVED' : currentStatus === 'REJECTED' ? 'REJECTED' : 'APPROVED'
  );
  const [reviewNotes, setReviewNotes] = useState(initialNotes);
  const [rejectionReason, setRejectionReason] = useState(initialRejectionReason);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (decision === 'REJECTED' && !rejectionReason.trim()) {
      setMsg({ text: 'A rejection reason is required for the applicant.', error: true });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: decision,
          reviewNotes,
          rejectionReason: decision === 'REJECTED' ? rejectionReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Failed to submit review', error: true });
      } else {
        setMsg({ text: `Application has been marked as ${decision}`, error: false });
        router.refresh();
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
        <label className="label">Decision</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="APPROVED"
              checked={decision === 'APPROVED'}
              onChange={() => setDecision('APPROVED')}
              className="accent-[var(--accent)]"
            />
            Approve Application
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="REJECTED"
              checked={decision === 'REJECTED'}
              onChange={() => setDecision('REJECTED')}
              className="accent-red-500"
            />
            Reject Application
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="radio"
              name="decision"
              value="UNDER_REVIEW"
              checked={decision === 'UNDER_REVIEW'}
              onChange={() => setDecision('UNDER_REVIEW')}
              className="accent-yellow-500"
            />
            Keep Under Review
          </label>
        </div>
      </div>

      {decision === 'REJECTED' && (
        <div>
          <label className="label">
            Rejection Reason <span className="text-[var(--error)]">* (Visible to customer)</span>
          </label>
          <textarea
            required
            rows={3}
            className="input-field"
            placeholder="Explain why the application is not approved at this time..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="label">Internal Review Notes (Admin only)</label>
        <textarea
          rows={2}
          className="input-field"
          placeholder="Optional notes for internal team reference..."
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={decision === 'REJECTED' ? 'btn-danger' : 'btn-primary'}
      >
        {loading ? 'Submitting decision...' : `Confirm ${decision}`}
      </button>
    </form>
  );
}

