import { mysqlTable, serial, varchar, text, timestamp, json, decimal, mysqlEnum, int, datetime } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Column builders for MySQL
 */
export const role = mysqlEnum("role", ["user", "admin"]);
export const personRole = mysqlEnum("personRole", ["patient", "doctor", "nurse", "other"]);
export const eventType = mysqlEnum("eventType", ["patient present", "patient absent", "unknown person detected", "person recognized"]);
export const severity = mysqlEnum("severity", ["info", "warning", "alert"]);
export const alertType = mysqlEnum("alertType", ["unknown person detected", "patient missing"]);

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: role.default("user").notNull(),
  createdAt: datetime("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSignedIn: datetime("lastSignedIn").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * People profiles (Patients, Doctors, Nurses) for monitoring
 */
export const people = mysqlTable("people", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: personRole.default("patient").notNull(),
  roomId: varchar("roomId", { length: 255 }), // Nullable for staff
  photoUrl: varchar("photoUrl", { length: 512 }),
  photoStorageKey: varchar("photoStorageKey", { length: 512 }),
  enrolledFaceDescriptor: json("enrolledFaceDescriptor"),
  firebaseId: varchar("firebaseId", { length: 255 }), // Sync ID from Firebase RTDB patients_meta
  isActive: int("isActive").default(1).notNull(),
  createdAt: datetime("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;

// For backward compatibility and specific patient queries
export const patients = people; 
export type Patient = Person;
export type InsertPatient = InsertPerson;

/**
 * Detection events log - records all face detection events
 */
export const detectionEvents = mysqlTable("detection_events", {
  id: int("id").autoincrement().primaryKey(),
  personId: int("personId"),
  userId: int("userId").notNull(),
  eventType: eventType.notNull(),
  severity: severity.notNull(),
  description: text("description"),
  detectedFaceDescriptor: json("detectedFaceDescriptor"),
  matchConfidence: decimal("matchConfidence", { precision: 5, scale: 4 }),
  roomId: varchar("roomId", { length: 255 }),
  timestamp: datetime("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: datetime("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type DetectionEvent = typeof detectionEvents.$inferSelect;
export type InsertDetectionEvent = typeof detectionEvents.$inferInsert;

/**
 * Alert logs - records critical alerts sent to owner
 */
export const alertLogs = mysqlTable("alert_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  detectionEventId: int("detectionEventId"),
  alertType: alertType.notNull(),
  severity: severity.notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  roomId: varchar("roomId", { length: 255 }),
  isResolved: int("isResolved").default(0).notNull(),
  notificationSent: int("notificationSent").default(0).notNull(),
  createdAt: datetime("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: datetime("resolvedAt"),
});

export type AlertLog = typeof alertLogs.$inferSelect;
export type InsertAlertLog = typeof alertLogs.$inferInsert;

/**
 * Detailed room activity logs
 */
export const roomActivityLogs = mysqlTable("room_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 255 }).notNull(),
  personId: int("personId"),
  activityType: varchar("activityType", { length: 100 }).notNull(), // entering, leaving, present, etc.
  details: text("details"),
  timestamp: datetime("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type RoomActivityLog = typeof roomActivityLogs.$inferSelect;
export type InsertRoomActivityLog = typeof roomActivityLogs.$inferInsert;