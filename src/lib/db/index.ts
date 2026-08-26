// Central export for all DB models and connection
export { default as connectToDatabase } from './connection';
export { default as User } from './models/User';
export { default as EmailVerification } from './models/EmailVerification';
export { default as PasswordReset } from './models/PasswordReset';
export { default as HostingApplication } from './models/HostingApplication';
export { default as PolicyDocument } from './models/PolicyDocument';
export { default as PolicyAcceptance } from './models/PolicyAcceptance';
export { default as ManagedDatabase } from './models/ManagedDatabase';
export { default as Subscription } from './models/Subscription';
export { default as Payment } from './models/Payment';
export { default as SupportTicket } from './models/SupportTicket';
export { default as TicketMessage } from './models/TicketMessage';
export { default as AuditLog } from './models/AuditLog';
export { default as Notification } from './models/Notification';

export type { IUser, UserRole, OnboardingStage, IUserProfile } from './models/User';
export type { IEmailVerification } from './models/EmailVerification';
export type { IPasswordReset } from './models/PasswordReset';
export type {
  IHostingApplication,
  ApplicationStatus,
  CompanyStage,
} from './models/HostingApplication';
export type { IPolicyDocument } from './models/PolicyDocument';
export type { IPolicyAcceptance } from './models/PolicyAcceptance';
export type { IManagedDatabase, DatabaseStatus } from './models/ManagedDatabase';
export type { ISubscription, SubscriptionStatus } from './models/Subscription';
export type { IPayment, PaymentStatus } from './models/Payment';
export type {
  ISupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from './models/SupportTicket';
export type { ITicketMessage } from './models/TicketMessage';
export type { IAuditLog, AuditAction } from './models/AuditLog';
export type { INotification, NotificationType } from './models/Notification';
