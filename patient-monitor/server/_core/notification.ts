/**
 * Notification stub.
 * The Manus notification service has been removed.
 * Critical alerts are now written directly to the Firebase Realtime Database
 * via the activity logging system.
 */
export type NotificationPayload = {
  title: string;
  content: string;
};

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  // Log locally for now — notifications go to Firebase activity logs
  console.log(`[Alert] ${payload.title}: ${payload.content}`);
  return true;
}
