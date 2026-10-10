// Central export for all DB models, types, and connection utilities
import { default as connectToDatabase, getDb, getLioranDBClient, disconnectFromDatabase, resolveLioranDBUri } from './connection';
import { ObjectId, Types, Schema, model, models } from './adapter';
import type { Db } from '@liorandb/driver';

import User from './models/User';
import EmailVerification from './models/EmailVerification';
import PasswordReset from './models/PasswordReset';
import PolicyDocument from './models/PolicyDocument';
import PolicyAcceptance from './models/PolicyAcceptance';
import ManagedDatabase from './models/ManagedDatabase';
import Subscription from './models/Subscription';
import Payment from './models/Payment';
import Invoice from './models/Invoice';
import Coupon from './models/Coupon';
import BillingInterval from './models/BillingInterval';
import SupportTicket from './models/SupportTicket';
import TicketMessage from './models/TicketMessage';
import AuditLog from './models/AuditLog';
import Notification from './models/Notification';
import Wallet from './models/Wallet';
import WalletTransaction from './models/WalletTransaction';
import HostingNode from './models/HostingNode';

export { connectToDatabase, getDb, getLioranDBClient, disconnectFromDatabase, resolveLioranDBUri };
export { ObjectId, Types, Schema, model, models };

export {
  User,
  EmailVerification,
  PasswordReset,
  PolicyDocument,
  PolicyAcceptance,
  ManagedDatabase,
  Subscription,
  Payment,
  Invoice,
  Coupon,
  BillingInterval,
  SupportTicket,
  TicketMessage,
  AuditLog,
  Notification,
  Wallet,
  WalletTransaction,
  HostingNode,
};

/**
 * Idempotently initializes all required collections and declared indexes for the Connexus application.
 * Only applied to Connexus's own application database (lcs); never to empty customer databases.
 */
export async function initConnexusCollectionsAndIndexes(targetDb?: Db): Promise<void> {
  const db = targetDb || (await getDb());
  const connexusModels = [
    User,
    EmailVerification,
    PasswordReset,
    HostingNode,
    ManagedDatabase,
    BillingInterval,
    Invoice,
    Payment,
    Subscription,
    Wallet,
    WalletTransaction,
    SupportTicket,
    TicketMessage,
    AuditLog,
    Notification,
    PolicyDocument,
    PolicyAcceptance,
    Coupon,
  ];

  for (const m of connexusModels) {
    await m.ensureCollectionReady(db);
  }
}

export type { IUser, UserRole, OnboardingStage, IUserProfile, IAccountVerification } from './models/User';
export type { IEmailVerification } from './models/EmailVerification';
export type { IPasswordReset } from './models/PasswordReset';
export type { IPolicyDocument } from './models/PolicyDocument';
export type { IPolicyAcceptance } from './models/PolicyAcceptance';
export type { IManagedDatabase, DatabaseStatus, DatabaseType, IDatabaseUser } from './models/ManagedDatabase';
export type { ISubscription, SubscriptionStatus } from './models/Subscription';
export type { IPayment, PaymentStatus, PaymentType } from './models/Payment';
export type { IInvoice, InvoiceStatus, IInvoiceLineItem } from './models/Invoice';
export type { ICoupon, CouponScope } from './models/Coupon';
export type { IBillingInterval } from './models/BillingInterval';
export type {
  ISupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from './models/SupportTicket';
export type { ITicketMessage } from './models/TicketMessage';
export type { IAuditLog, AuditAction } from './models/AuditLog';
export type { INotification, NotificationType } from './models/Notification';
export type { IWallet } from './models/Wallet';
export type {
  IWalletTransaction,
  WalletTransactionType,
  WalletTransactionCategory,
} from './models/WalletTransaction';
export type { IHostingNode, HostingNodeStatus, HostingProtocol } from './models/HostingNode';
