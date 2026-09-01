import type { OnboardingStage } from '@/lib/db/models/User';
import { CheckCircle2, XCircle, Clock, Circle } from 'lucide-react';

interface Step {
  label: string;
  stage: OnboardingStage[];
  rejectStage?: OnboardingStage[];
}

const STEPS: Step[] = [
  { label: 'Account created', stage: ['EMAIL_VERIFICATION', 'APPLICATION_REQUIRED', 'APPLICATION_PENDING', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
  { label: 'Email verified', stage: ['APPLICATION_REQUIRED', 'APPLICATION_PENDING', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
  { label: 'Application submitted', stage: ['APPLICATION_PENDING', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
  {
    label: 'Application review & validation',
    stage: ['APPLICATION_APPROVED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'],
    rejectStage: ['APPLICATION_REJECTED'],
  },
  { label: 'Legal agreements accepted', stage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
  { label: 'Database cluster provisioned', stage: ['ACTIVE', 'SUSPENDED'] },
  { label: 'Production service active', stage: ['ACTIVE'] },
];

interface Props {
  stage: OnboardingStage;
  rejectionReason?: string;
}

export default function StatusTimeline({ stage, rejectionReason }: Props) {
  return (
    <div className="space-y-3">
      {STEPS.map((step, idx) => {
        const isComplete = step.stage.includes(stage);
        const isRejected = step.rejectStage?.includes(stage);
        const isCurrent = !isComplete && !isRejected && idx > 0 && STEPS[idx - 1].stage.includes(stage);

        return (
          <div key={idx} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {isRejected ? (
                <XCircle className="w-4 h-4 text-red-400" />
              ) : isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : isCurrent ? (
                <Clock className="w-4 h-4 text-[var(--accent)] animate-pulse" />
              ) : (
                <Circle className="w-4 h-4 text-[var(--text-muted)] opacity-40" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-xs ${
                  isRejected
                    ? 'text-red-400 font-medium'
                    : isComplete
                    ? 'text-[var(--text-secondary)]'
                    : isCurrent
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {step.label}
              </p>
              {isRejected && rejectionReason && (
                <p className="text-[11px] text-red-300 mt-0.5">
                  Reason: {rejectionReason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

