export type UserRole = "user" | "admin";
export type PersonRole = "patient" | "doctor" | "nurse" | "other";
export type EventType = "patient present" | "patient absent" | "unknown person detected" | "person recognized";
export type Severity = "info" | "warning" | "alert";
export type AlertType = "unknown person detected" | "patient missing" | "person recognized";

export interface User {
  id: string; // Using string (UID) instead of serial int
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
}

export type InsertUser = Partial<User> & { openId: string };

export interface Person {
  id: string;
  userId: string;
  name: string;
  role: PersonRole;
  email: string | null; // For staff notifications
  roomId: string | null;
  photoUrl: string | null;
  photoStorageKey: string | null;
  enrolledFaceDescriptor: any;
  assignedDoctorId: string | null; // For patients
  assignedNurseId: string | null; // For patients
  firebaseId?: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export type InsertPerson = Omit<Person, "id" | "createdAt" | "updatedAt">;

export interface DetectionEvent {
  id: string;
  personId?: string | null;
  userId: string;
  eventType: EventType;
  severity: Severity;
  description: string | null;
  detectedFaceDescriptor: any;
  matchConfidence: string | null;
  roomId: string | null;
  isAuthorized: number; // 1 if authorized (staff or patient), 0 otherwise
  timestamp: string;
  createdAt: string;
}

export type InsertDetectionEvent = Omit<DetectionEvent, "id" | "createdAt">;

export interface AlertLog {
  id: string;
  userId: string;
  detectionEventId: string | null;
  alertType: AlertType;
  severity: Severity;
  title: string;
  message: string | null;
  roomId: string | null;
  isResolved: number;
  notificationSent: number;
  createdAt: string;
  resolvedAt: string | null;
}

export type InsertAlertLog = Omit<AlertLog, "id" | "isResolved" | "notificationSent" | "createdAt" | "resolvedAt">;

export interface RoomActivityLog {
  id: string;
  roomId: string;
  personId: string | null;
  activityType: string;
  details: string | null;
  timestamp: string;
}

export type InsertRoomActivityLog = Omit<RoomActivityLog, "id">;

// Backward compatibility
export type Patient = Person;
export type InsertPatient = InsertPerson;
