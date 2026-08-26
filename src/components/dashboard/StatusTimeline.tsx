import type { OnboardingStage } from '@/lib/db/models/User';

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
    label: 'Application review',
    stage: ['APPLICATION_APPROVED', 'TERMS_REQUIRED', 'PROVISIONING', 'ACTIVE', 'SUSPENDED'],
    rejectStage: ['APPLICATION_REJECTED'],
  },
  { label: 'Agreements accepted', stage: ['PROVISIONING', 'ACTIVE', 'SUSPENDED'] },
  { label: 'Database provisioned', stage: ['ACTIVE', 'SUSPENDED'] },
  { label: 'Service active', stage: ['ACTIVE'] },
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

        let icon = '○';
        let textClass = 'text-[var(--text-muted)]';
        let iconClass = 'text-[var(--text-muted)]';

        if (isRejected) {
          icon = '✕';
          textClass = 'text-red-400';
          iconClass = 'text-red-400';
        } else if (isComplete) {
          icon = '✓';
          textClass = 'text-[var(--text-secondary)]';
          iconClass = 'text-green-400';
        } else if (isCurrent) {
          icon = '●';
          textClass = 'text-[var(--text-primary)] font-medium';
          iconClass = 'text-[var(--accent)]';
        }

        return (
          <div key={idx} className="flex items-start gap-3">
            <div className={`w-5 text-center text-sm font-mono mt-0.5 ${iconClass}`}>
              {icon}
            </div>
            <div className="flex-1">
              <p className={`text-sm ${textClass}`}>{step.label}</p>
              {isRejected && rejectionReason && (
                <p className="text-xs text-red-300 mt-0.5">
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
