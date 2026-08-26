import { connectToDatabase, Notification } from '../db';
import type { NotificationType } from '../db/models/Notification';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await connectToDatabase();
    await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    });
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.countDocuments({ userId, read: false });
}

export async function markAllRead(userId: string): Promise<void> {
  await connectToDatabase();
  await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
}
