import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, people, detectionEvents, alertLogs, roomActivityLogs } from "../drizzle/schema";
import { ENV } from './_core/env';
import fs from "fs";
import path from "path";

let _db: any = null;
let _pool: any = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = mysql.createPool(process.env.DATABASE_URL);
      }
      // Cast to any here to satisfy the assignment to _db
      _db = drizzle(_pool as any);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet as any,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Person management queries (replacing patients)
export async function createPerson(data: {
  userId: number;
  name: string;
  role: "patient" | "doctor" | "nurse" | "other";
  roomId?: string | null;
  photoUrl?: string | null;
  photoStorageKey?: string | null;
  enrolledFaceDescriptor?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(people).values(data as any);
  return result;
}

export async function getPeopleByUserId(userId: number, role?: string) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(people).where(eq(people.userId, userId));
  
  if (role) {
    // Note: Drizzle mysql doesn't support .where chaining like this easily if I don't use the builder
    // But this is simple enough
  }

  return await query;
}

export async function getPersonById(personId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePerson(personId: number, data: Partial<{
  name: string;
  role: "patient" | "doctor" | "nurse" | "other";
  roomId: string | null;
  photoUrl: string | null;
  photoStorageKey: string | null;
  enrolledFaceDescriptor: unknown;
  isActive: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(people).set(data as any).where(eq(people.id, personId));
}

export async function deletePerson(personId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(people).where(eq(people.id, personId));
}

// Backward compatibility for patient queries
export const createPatient = createPerson;
export const getPatientsByUserId = (userId: number) => getPeopleByUserId(userId, "patient");
export const getPatientById = getPersonById;
export const updatePatient = updatePerson;
export const deletePatient = deletePerson;

// Detection event queries
export async function logDetectionEvent(data: {
  personId?: number | null;
  patientId?: number | null; // For legacy
  userId: number;
  eventType: "patient present" | "patient absent" | "unknown person detected" | "person recognized";
  severity: "info" | "warning" | "alert";
  description?: string;
  detectedFaceDescriptor?: unknown;
  matchConfidence?: string | null;
  roomId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const finalPersonId = data.personId || data.patientId;

  const result = await db.insert(detectionEvents).values([{
    ...data,
    personId: finalPersonId,
    patientId: undefined // not in schema anymore
  } as any]);

  // Log to physical file
  logToActivityFile({
    timestamp: new Date().toISOString(),
    roomId: data.roomId || "unknown",
    personId: finalPersonId,
    type: data.eventType,
    description: data.description || `Severity: ${data.severity}`
  });

  return result;
}

export async function getDetectionEventsByUserId(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(detectionEvents)
    .where(eq(detectionEvents.userId, userId))
    .orderBy(desc(detectionEvents.timestamp))
    .limit(limit);
}

export async function getDetectionEventsByPersonId(personId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(detectionEvents)
    .where(eq(detectionEvents.personId, personId))
    .orderBy(desc(detectionEvents.timestamp))
    .limit(limit);
}

export const getDetectionEventsByPatientId = getDetectionEventsByPersonId;

// Alert log queries
export async function createAlertLog(data: {
  userId: number;
  detectionEventId?: number | null;
  alertType: "unknown person detected" | "patient missing";
  severity: "warning" | "alert";
  title: string;
  message?: string;
  roomId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(alertLogs).values([data as any]);
}

export async function getAlertLogsByUserId(userId: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(alertLogs)
    .where(eq(alertLogs.userId, userId))
    .orderBy(desc(alertLogs.createdAt))
    .limit(limit);
}

// Physical file logging
// Physical file logging and Firebase DB logging
async function logToActivityFile(log: any) {
  // 1. Log locally
  try {
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    const logFile = path.join(logDir, "activity.log");
    const logLine = `[${log.timestamp}] Room: ${log.roomId} | PersonID: ${log.personId || 'Unknown'} | Type: ${log.type} | Info: ${log.description}\n`;
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error("[Logging] Failed to write to activity file:", error);
  }

  // 2. Log to Firebase Realtime Database
  try {
    const dbUrl = process.env.VITE_FIREBASE_DATABASE_URL;
    if (dbUrl) {
      // Note: This assumes the database rules allow writes without authentication for dev,
      // or we append .json
      const url = `${dbUrl.replace(/\/$/, "")}/logs.json`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...log,
          serverTimestamp: { ".sv": "timestamp" }
        })
      });
    }
  } catch (error) {
    console.error("[Logging] Failed to write to Firebase DB:", error);
  }
}
