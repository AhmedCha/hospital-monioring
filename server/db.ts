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
  
  if (!doc.exists) {
    const data: any = {
      id: user.openId,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? "firebase",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
      role: (user.openId === ENV.ownerOpenId) ? "admin" : (user.role ?? "user"),
    };
    await userRef.set(data);
  } else {
    // Only update provided fields
    const updateData: any = { updatedAt: now };
    if (user.name !== undefined) updateData.name = user.name;
    if (user.email !== undefined) updateData.email = user.email;
    if (user.loginMethod !== undefined) updateData.loginMethod = user.loginMethod;
    if (user.lastSignedIn !== undefined) updateData.lastSignedIn = user.lastSignedIn;
    if (user.role !== undefined) updateData.role = user.role;
    
    await userRef.update(updateData);
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  console.log(`[Database] Getting user by openId: ${openId}`);
  const doc = await adminFirestore.collection("users").doc(openId).get();
  if (!doc.exists) {
    console.log(`[Database] User not found: ${openId}`);
    return undefined;
  }
  console.log(`[Database] User found: ${openId}`);
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
  console.log(`[Database] Getting people for user: ${userId}, role: ${role || 'any'}`);
  let query: any = adminFirestore.collection("people").where("userId", "==", userId);
  if (role) {
    query = query.where("role", "==", role);
  }
  const snapshot = await query.get();
  console.log(`[Database] Found ${snapshot.size} people`);
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

// --- Detection Events (Firestore) ---

export async function logDetectionEvent(data: InsertDetectionEvent): Promise<{ id: string }> {
  const eventData = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  const docRef = await adminFirestore.collection("detectionEvents").add(eventData);
  
  // Store in Realtime Database as well for client listeners
  await (adminDb as any).ref(`detectionEvents/${data.userId}`).push({
    ...eventData,
    id: docRef.id
  });
  
  return { id: docRef.id };
}

export async function getDetectionEventsByUserId(userId: string, limit: number = 100): Promise<DetectionEvent[]> {
  const snapshot = await adminFirestore.collection("detectionEvents")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
    
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as DetectionEvent));
}

export async function logRoomActivity(data: InsertRoomActivityLog): Promise<{ id: string }> {
  const activityData = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  };
  
  const docRef = await adminFirestore.collection("roomActivityLogs").add(activityData);
  
  await (adminDb as any).ref(`roomActivityLogs/${data.roomId}`).push({
    ...activityData,
    id: docRef.id
  });
  
  return { id: docRef.id };
}

export async function getRoomActivityLogsByRoomId(roomId: string, limit: number = 50): Promise<RoomActivityLog[]> {
  const snapshot = await adminFirestore.collection("roomActivityLogs")
    .where("roomId", "==", roomId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
    
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as RoomActivityLog));
}

export async function getDetectionEventsByPersonId(personId: string, limit: number = 100): Promise<DetectionEvent[]> {
  // Actually, for simplicity, let's use Firestore for events if we need many-to-many filtering.
  // BUT the user wants real-time. Let's keep RTDB and just use a flatter structure if needed.
  
  // Refined: Query all events for a user and filter for the person.
  // In a real app, we'd store a secondary index `personEvents/${personId}`.
  const snapshot = await (adminDb as any).ref(`detectionEvents`)
    .once("value");
  
  const allEvents: any[] = [];
  snapshot.forEach((userEvents: any) => {
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
  const alertData = {
    ...data,
    id: "", // placeholder
    isResolved: 0,
    notificationSent: 0,
    createdAt: now,
    resolvedAt: null,
  };
  const res = await adminFirestore.collection("alertLogs").add(alertData);
  alertData.id = res.id;
  await res.update({ id: res.id });
  
  // Store in Realtime Database as well for client listeners
  await (adminDb as any).ref(`alertLogs/${data.userId}`).push(alertData);
  
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
  await (adminDb as any).ref("roomActivityLogs").push({
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

export async function getFirebasePatientsMeta(): Promise<any> {
  const snapshot = await (adminDb as any).ref("patients_meta").once("value");
  return snapshot.val();
}
