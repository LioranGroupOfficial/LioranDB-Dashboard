import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Notification, PolicyAcceptance } from '@/lib/db';
import AccountSettingsForm from '@/components/account/AccountSettingsForm';
import PasswordChangeForm from '@/components/account/PasswordChangeForm';
import NotificationList from '@/components/account/NotificationList';

export const metadata = { title: 'Account Settings' };

export default async function AccountPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const [user, notifications, acceptances] = await Promise.all([
    User.findById(sessionUser.userId).lean(),
    Notification.find({ userId: sessionUser.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    PolicyAcceptance.find({ userId: sessionUser.userId })
      .sort({ acceptedAt: -1 })
      .lean(),
  ]);

  if (!user) return null;

  const userData = {
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingStage: user.onboardingStage,
    profile: {
      fullName: user.profile?.fullName || '',
      company: user.profile?.company || '',
      phone: user.profile?.phone || '',
      country: user.profile?.country || '',
    },
  };

  const notificationList = notifications.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  }));

  const acceptanceList = acceptances.map((a) => ({
    id: a._id.toString(),
    policySlug: a.policySlug,
    policyVersion: a.policyVersion,
    acceptedAt: a.acceptedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Account Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage your profile, security, and notification preferences
        </p>
      </div>

      {/* Profile form */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Profile Information
        </h2>
        <AccountSettingsForm initialData={userData} />
      </div>

      {/* Password change form */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Security
        </h2>
        <PasswordChangeForm />
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
          Recent Notifications
        </h2>
        <NotificationList notifications={notificationList} />
      </div>

      {/* Accepted Agreements */}
      {acceptanceList.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
            Accepted Agreements
          </h2>
          <div className="space-y-2">
            {acceptanceList.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-2 border-b border-[var(--border)] text-sm">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{a.policySlug}</span>
                  <span className="text-xs text-[var(--text-muted)] ml-2">v{a.policyVersion}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  Accepted on {new Date(a.acceptedAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

