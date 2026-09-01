import { requireVerifiedUser } from '@/lib/auth/guards';
import { connectToDatabase, User, Notification, PolicyAcceptance, Payment } from '@/lib/db';
import AccountSettingsForm from '@/components/account/AccountSettingsForm';
import PasswordChangeForm from '@/components/account/PasswordChangeForm';
import NotificationList from '@/components/account/NotificationList';
import DeleteAccountSection from '@/components/account/DeleteAccountSection';
import { UserCog, Shield, Bell, FileCheck } from 'lucide-react';

export const metadata = { title: 'Account Settings' };

export default async function AccountPage() {
  const sessionUser = await requireVerifiedUser();
  await connectToDatabase();

  const [user, notifications, acceptances, unpaidPayments] = await Promise.all([
    User.findById(sessionUser.userId).lean(),
    Notification.find({ userId: sessionUser.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    PolicyAcceptance.find({ userId: sessionUser.userId })
      .sort({ acceptedAt: -1 })
      .lean(),
    Payment.find({
      userId: sessionUser.userId,
      status: { $in: ['PENDING', 'SUBMITTED'] },
    }).lean(),
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

  const hasPendingPayments = unpaidPayments.length > 0;
  const pendingTotal = unpaidPayments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Account Settings</h1>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Manage your developer profile, security credentials, and organization preferences
        </p>
      </div>

      {/* Profile form */}
      <div className="card">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider flex items-center gap-1.5">
          <UserCog className="w-3.5 h-3.5 text-[var(--accent)]" />
          Profile Information
        </h2>
        <AccountSettingsForm initialData={userData} />
      </div>

      {/* Password change form */}
      <div className="card">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
          Security Credentials
        </h2>
        <PasswordChangeForm />
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-[var(--accent)]" />
          Recent Notifications
        </h2>
        <NotificationList notifications={notificationList} />
      </div>

      {/* Accepted Agreements */}
      {acceptanceList.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wider flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
            Accepted Legal Agreements
          </h2>
          <div className="space-y-2">
            {acceptanceList.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-2 border-b border-[var(--border)] text-xs">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{a.policySlug}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono ml-2">v{a.policyVersion}</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Accepted on {new Date(a.acceptedAt).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone: Delete Account */}
      <DeleteAccountSection
        hasPendingPayments={hasPendingPayments}
        pendingCount={unpaidPayments.length}
        pendingTotal={pendingTotal}
      />
    </div>
  );
}


