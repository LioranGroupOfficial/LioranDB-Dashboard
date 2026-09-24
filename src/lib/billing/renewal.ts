import { connectToDatabase, Subscription, ManagedDatabase, User } from '../db';
import { debitWallet, InsufficientBalanceError } from '../wallet';
import { createNotification } from '../notifications';
import { createAuditLog } from '../audit';
import { formatPaiseToRupees } from '../plans';

export const DEFAULT_GRACE_PERIOD_DAYS = 3;

export interface RenewalResult {
  renewedCount: number;
  gracePeriodCount: number;
  suspendedCount: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Scheduled/Triggered job to process recurring monthly renewals using LioranDB Credits.
 */
export async function processSubscriptionRenewals(): Promise<RenewalResult> {
  await connectToDatabase();
  const now = new Date();

  const result: RenewalResult = {
    renewedCount: 0,
    gracePeriodCount: 0,
    suspendedCount: 0,
    errors: [],
  };

  // 1. Find subscriptions due for renewal
  const dueSubscriptions = await Subscription.find({
    status: { $in: ['ACTIVE', 'PAYMENT_DUE', 'GRACE_PERIOD'] },
    autoRenew: true,
    $or: [
      { nextBillingAt: { $lte: now } },
      { nextPaymentDate: { $lte: now } },
      { status: 'GRACE_PERIOD' },
    ],
  });

  for (const sub of dueSubscriptions) {
    try {
      const pricePaise =
        sub.totalPricePaise ||
        sub.monthlyPricePaise ||
        Math.round(sub.amount * 100);

      const periodKey = `${sub._id.toString()}_${now.getFullYear()}_${now.getMonth() + 1}`;
      const idempotencyKey = `renew_${periodKey}`;

      // Try debiting from wallet
      try {
        await debitWallet({
          userId: sub.userId,
          amountPaise: pricePaise,
          category: 'subscription_renewal',
          description: `Monthly renewal for ${sub.planName}`,
          subscriptionId: sub._id,
          instanceId: sub.instanceId || sub.databaseId,
          idempotencyKey,
        });

        // Renewal succeeded
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        sub.status = 'ACTIVE';
        sub.lastChargedAt = now;
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = nextMonth;
        sub.nextBillingAt = nextMonth;
        sub.nextPaymentDate = nextMonth;
        sub.gracePeriodEndsAt = undefined;
        await sub.save();

        if (sub.instanceId || sub.databaseId) {
          await ManagedDatabase.findByIdAndUpdate(sub.instanceId || sub.databaseId, {
            status: 'ACTIVE',
            suspendedAt: undefined,
            suspensionReason: undefined,
          });
        }

        await createNotification({
          userId: sub.userId.toString(),
          type: 'PAYMENT_RECEIVED',
          title: 'Subscription Renewed',
          body: `Your subscription for ${sub.planName} has been successfully renewed (${formatPaiseToRupees(
            pricePaise
          )} credits deducted).`,
          link: '/billing',
        });

        result.renewedCount++;
      } catch (err: unknown) {
        if (err instanceof InsufficientBalanceError) {
          // Check if already in grace period
          if (sub.status === 'GRACE_PERIOD' && sub.gracePeriodEndsAt) {
            if (sub.gracePeriodEndsAt < now) {
              // Grace period expired -> Suspend instance without deleting data
              sub.status = 'SUSPENDED';
              sub.suspendedAt = now;
              sub.suspensionReason =
                'Subscription renewal failed due to insufficient credits after grace period.';
              await sub.save();

              if (sub.instanceId || sub.databaseId) {
                await ManagedDatabase.findByIdAndUpdate(
                  sub.instanceId || sub.databaseId,
                  {
                    status: 'SUSPENDED',
                    suspendedAt: now,
                    suspensionReason:
                      'Cluster suspended due to unpaid renewal. Please add credits to resume.',
                  }
                );
              }

              await createNotification({
                userId: sub.userId.toString(),
                type: 'SERVICE_SUSPENDED',
                title: 'Instance Suspended',
                body: `Your instance was suspended because credits were not added during the ${DEFAULT_GRACE_PERIOD_DAYS}-day grace period. Your data is preserved. Add credits to restore service.`,
                link: '/billing',
              });

              result.suspendedCount++;
            }
          } else {
            // First failure -> enter grace period
            const graceEnd = new Date(
              now.getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
            );
            sub.status = 'GRACE_PERIOD';
            sub.gracePeriodEndsAt = graceEnd;
            await sub.save();

            await createNotification({
              userId: sub.userId.toString(),
              type: 'PAYMENT_OVERDUE',
              title: 'Subscription Renewal Due',
              body: `We couldn't renew ${sub.planName} (${formatPaiseToRupees(
                pricePaise
              )}). You have a ${DEFAULT_GRACE_PERIOD_DAYS}-day grace period until ${graceEnd.toLocaleDateString(
                'en-IN'
              )} to add credits before service suspension.`,
              link: '/billing',
            });

            result.gracePeriodCount++;
          }
        } else {
          throw err;
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown renewal error';
      result.errors.push({ subscriptionId: sub._id.toString(), error: errMsg });
    }
  }

  return result;
}

