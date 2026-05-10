import { adminFirestore, adminDb } from "./_core/firebase";
import { 
  User, InsertUser, 
  Person, InsertPerson, 
  DetectionEvent, InsertDetectionEvent,
  AlertLog, InsertAlertLog,
  RoomActivityLog, InsertRoomActivityLog
} from "../shared/schema";
import { ENV } from './_core/env';

// --- Users ---

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const userRef = adminFirestore.collection("users").doc(user.openId);
  const doc = await userRef.get();

  const now = new Date().toISOString();
  const data: any = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? "firebase",
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now,
  };

  if (!doc.exists) {
    data.id = user.openId;
    data.createdAt = now;
    data.role = (user.openId === ENV.ownerOpenId) ? "admin" : (user.role ?? "user");
    await userRef.set(data);
  } else {
    // Only update provided fields
    const updateData: any = { ...data };
    delete updateData.id;
    delete updateData.createdAt;
    await userRef.update(updateData);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const doc = await adminFirestore.collection("users").doc(openId).get();
  if (!doc.exists) return undefined;
  return doc.data() as User;
}

// --- People (Patients & Staff) ---

export async function createPerson(data: InsertPerson): Promise<{ id: string }> {
  const res = await adminFirestore.collection("people").add({
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: 1,
  });
  await res.update({ id: res.id });
  return { id: res.id };
}

export async function getPeopleByUserId(userId: string, role?: string): Promise<Person[]> {
  let query: any = adminFirestore.collection("people").where("userId", "==", userId);
  if (role) {
    query = query.where("role", "==", role);
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => doc.data() as Person);
}

export async function getPersonById(personId: string): Promise<Person | undefined> {
  const doc = await adminFirestore.collection("people").doc(personId).get();
  if (!doc.exists) return undefined;
  return doc.data() as Person;
}

export async function updatePerson(personId: string, data: Partial<InsertPerson & { isActive: number }>): Promise<void> {
  await adminFirestore.collection("people").doc(personId).update({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePerson(personId: string): Promise<void> {
  await adminFirestore.collection("people").doc(personId).delete();
}

// Backward compatibility
export const createPatient = createPerson;
export const getPatientsByUserId = (userId: string) => getPeopleByUserId(userId, "patient");
export const getPatientById = getPersonById;
export const updatePatient = updatePerson;
export const deletePatient = deletePerson;

// --- Detection Events (RTDB for Real-time) ---

export async function logDetectionEvent(data: InsertDetectionEvent): Promise<{ id: string }> {
  const eventRef = adminDb.ref(`detectionEvents/${data.userId}`).push();
  const eventId = eventRef.key!;
  const now = new Date().toISOString();
  
  const eventData = {
    ...data,
    id: eventId,
    timestamp: data.timestamp || now,
    createdAt: now,
  };

  await eventRef.set(eventData);

  // Also log to Activity Logs
  await logToActivity({
    roomId: data.roomId || "unknown",
    personId: data.personId || null,
    activityType: data.eventType,
    details: data.description || `Severity: ${data.severity}`,
    timestamp: now,
  });

  return { id: eventId };
}

export async function getDetectionEventsByUserId(userId: string, limit: number = 100): Promise<DetectionEvent[]> {
  const snapshot = await adminDb.ref(`detectionEvents/${userId}`)
    .orderByChild("timestamp")
    .limitToLast(limit)
    .once("value");
  
  const val = snapshot.val();
  if (!val) return [];
  
  return Object.values(val) as DetectionEvent[];
}

export async function getDetectionEventsByPersonId(personId: string, limit: number = 100): Promise<DetectionEvent[]> {
  // RTDB doesn't support complex filtering well across all users easily without indexing
  // But we can filter client-side or restructure if needed.
  // For now, let's assume we query by userId first then filter.
  // Actually, for simplicity, let's use Firestore for events if we need many-to-many filtering.
  // BUT the user wants real-time. Let's keep RTDB and just use a flatter structure if needed.
  
  // Refined: Query all events for a user and filter for the person.
  // In a real app, we'd store a secondary index `personEvents/${personId}`.
  const snapshot = await adminDb.ref(`detectionEvents`)
    .once("value");
  
  const allEvents: any[] = [];
  snapshot.forEach((userEvents) => {
    userEvents.forEach((event: any) => {
      if (event.val().personId === personId) {
        allEvents.push(event.val());
      }
    });
  });

  return allEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export const getDetectionEventsByPatientId = getDetectionEventsByPersonId;

// --- Alert Logs ---

export async function createAlertLog(data: InsertAlertLog): Promise<{ id: string }> {
  const now = new Date().toISOString();
  const res = await adminFirestore.collection("alertLogs").add({
    ...data,
    id: "", // placeholder
    isResolved: 0,
    notificationSent: 0,
    createdAt: now,
    resolvedAt: null,
  });
  await res.update({ id: res.id });
  return { id: res.id };
}

export async function getAlertLogsByUserId(userId: string, limit: number = 100): Promise<AlertLog[]> {
  const snapshot = await adminFirestore.collection("alertLogs")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  
  return snapshot.docs.map((doc: any) => doc.data() as AlertLog);
}

// --- Activity Logs ---

async function logToActivity(data: InsertRoomActivityLog): Promise<void> {
  await adminDb.ref("roomActivityLogs").push({
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}
