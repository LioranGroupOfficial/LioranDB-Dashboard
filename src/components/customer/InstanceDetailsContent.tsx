import Link from 'next/link';
import { Activity, ArrowLeft, BookOpen, Clock, CreditCard, ShieldCheck, Tag } from 'lucide-react';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { getPlan, formatPaiseToRupees } from '@/lib/plans';
import { decrypt } from '@/lib/crypto';
import { getRootConnectionUri } from '@/lib/database-connection';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';
import DatabaseCredentials from '@/components/database/DatabaseCredentials';
import OpenStudioButton from '@/components/database/OpenStudioButton';
import DatabaseMigration from '@/components/database/DatabaseMigration';
import DatabaseUsersManager from '@/components/database/DatabaseUsersManager';
import CancelInstanceModal from '@/components/database/CancelInstanceModal';
import SharedStorageWidget from '@/components/customer/SharedStorageWidget';
import SharedCredentialRotationButton from '@/components/customer/SharedCredentialRotationButton';
import type { SessionData } from '@/lib/auth/session';

export default async function InstanceDetailsContent({ id, sessionUser }: { id: string; sessionUser: SessionData }) {
  await connectToDatabase();
  const instance = await ManagedDatabase.findById(id).lean();
  if (!instance) notFound();
  if (sessionUser.role !== 'admin' && sessionUser.role !== 'support' && instance.customerId.toString() !== sessionUser.userId && instance.userId?.toString() !== sessionUser.userId) redirect('/database');
  const plan = getPlan(instance.planId);
  const hourlyRatePaise = instance.hourlyRatePaise || plan?.hourlyRatePaise || 0;
  const discount = instance.couponDiscountPercentage || 0;
  const usage = calculateInstanceUsage(instance as unknown as IManagedDatabase, getCurrentMonthPeriod());
  let connectionUri: string | null = null;
  if (instance.encryptedConnectionUri) { try { connectionUri = getRootConnectionUri(decrypt(instance.encryptedConnectionUri), instance.port); } catch {} }
  const dbData = { id: instance._id.toString(), name: instance.name, status: instance.status, serverHealth: instance.serverHealth, host: instance.host, port: instance.port, databaseName: instance.databaseName, username: instance.username, connectionUri, planId: instance.planId, billingStartedAt: instance.billingStartedAt?.toISOString(), provisionedAt: instance.provisionedAt?.toISOString() };
  const users = (instance.databaseUsers || []).map((user) => { let password = ''; if (user.encryptedPassword) { try { password = decrypt(user.encryptedPassword); } catch {} } return { username: user.username, role: user.role || 'read_write', status: user.status || 'ACTIVE', password: password || undefined, createdAt: user.createdAt || instance.createdAt }; });
  const shared = instance.type === 'shared' || instance.planId === 'free';
  return <div className="mx-auto max-w-5xl space-y-6 pb-16"><Link href="/database" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"><ArrowLeft className="h-3.5 w-3.5" />Back to Database Instances</Link><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-3"><h1 className="break-all text-2xl font-bold tracking-tight text-[var(--text-strong)] sm:text-3xl">{instance.name}</h1><span className="badge badge-default">{instance.status}</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">{shared ? 'Free Shared' : instance.planName || plan?.name || 'Dedicated'} Plan · {instance.region || 'Region unavailable'}</p></div><div className="flex flex-wrap gap-2"><a href="https://docs.liorandb.com/docs/driver/overview" target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs"><BookOpen className="h-3.5 w-3.5" />Developer Docs</a><OpenStudioButton db={dbData} className="btn-secondary text-xs" /><Link href="/billing" className="btn-secondary text-xs"><CreditCard className="h-3.5 w-3.5" />Billing</Link></div></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div className="card p-4"><p className="label"><CreditCard className="mr-1 inline h-3.5 w-3.5" />Hourly Rate</p><p className="mt-1 font-mono text-lg font-bold">{shared ? 'Free' : `${formatPaiseToRupees(Math.round(hourlyRatePaise * (1 - discount / 100)))}/hr`}</p></div><div className="card p-4"><p className="label"><Clock className="mr-1 inline h-3.5 w-3.5" />Current Usage</p><p className="mt-1 font-mono text-lg font-bold">{usage.billableHours.toFixed(1)} hrs</p></div><div className="card p-4"><p className="label"><Activity className="mr-1 inline h-3.5 w-3.5" />Estimated Cost</p><p className="mt-1 font-mono text-lg font-bold">{shared ? '₹0' : formatPaiseToRupees(usage.totalPaise)}</p></div><div className="card p-4"><p className="label"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Deployment</p><p className="mt-1 font-mono text-lg font-bold">{shared ? 'Shared pool' : 'Dedicated'}</p></div></div>{shared && instance.providerDeploymentId ? <div className="grid gap-4 md:grid-cols-2"><SharedStorageWidget tenantId={instance.providerDeploymentId} /><div className="card min-h-[164px] space-y-3 p-5"><p className="label">Credential management</p><p className="text-xs text-[var(--text-muted)]">Rotate shared database credentials when needed. The new secret is shown once.</p><SharedCredentialRotationButton tenantId={instance.providerDeploymentId} /></div></div> : null}{instance.couponCode ? <div className="flex items-center gap-2 border-2 border-[var(--hairline-strong)] p-3.5 text-xs"><Tag className="h-4 w-4" />Promo discount <strong>{instance.couponDiscountPercentage}% OFF</strong> applied ({instance.couponCode}).</div> : null}<DatabaseCredentials key={dbData.id} db={dbData} /><DatabaseMigration /><DatabaseUsersManager instanceId={instance._id.toString()} initialUsers={users} instanceStatus={instance.status} />{instance.status !== 'TERMINATED' && instance.status !== 'DELETED' ? <div className="card space-y-4 border-2 border-[var(--border)] p-6"><h2 className="text-sm font-bold uppercase tracking-wider">Danger Zone</h2><p className="text-xs text-[var(--text-secondary)]">Terminating this database stops usage accumulation and erases stored documents.</p><CancelInstanceModal instanceId={instance._id.toString()} instanceName={instance.name} /></div> : null}</div>;
}
