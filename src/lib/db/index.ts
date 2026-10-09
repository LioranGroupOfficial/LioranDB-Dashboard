// Central export for all DB models, types, and connection utilities
export { default as connectToDatabase, getDb, getLioranDBClient, disconnectFromDatabase, resolveLioranDBUri } from './connection';
export { ObjectId, Types, Schema, model, models } from './adapter';

export { default as User } from './models/User';
export { default as EmailVerification } from './models/EmailVerification';
export { default as PasswordReset } from './models/PasswordReset';
export { default as PolicyDocument } from './models/PolicyDocument';
export { default as PolicyAcceptance } from './models/PolicyAcceptance';
export { default as ManagedDatabase } from './models/ManagedDatabase';
export { default as Subscription } from './models/Subscription';
export { default as Payment } from './models/Payment';
export { default as Invoice } from './models/Invoice';
export { default as Coupon } from './models/Coupon';
export { default as BillingInterval } from './models/BillingInterval';
export { default as SupportTicket } from './models/SupportTicket';
export { default as TicketMessage } from './models/TicketMessage';
export { default as AuditLog } from './models/AuditLog';
export { default as Notification } from './models/Notification';
export { default as Wallet } from './models/Wallet';
export { default as WalletTransaction } from './models/WalletTransaction';
export { default as HostingNode } from './models/HostingNode';

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
