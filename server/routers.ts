import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { peopleRouter } from "./routers/people";
import { sdk } from "./_core/sdk";
import { verifyFirebaseToken } from "./_core/firebase";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ idToken: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[Auth] Starting login process...");
          const { uid, name, email } = await verifyFirebaseToken(input.idToken);
          console.log(`[Auth] Firebase token verified for: ${uid} (${email})`);

          // Sync user to Firestore
          console.log("[Auth] Upserting user to DB...");
          await db.upsertUser({
            openId: uid,
            name: name || email || "Anonymous",
            email: email || null,
            loginMethod: "firebase",
            lastSignedIn: new Date().toISOString(),
          });
          console.log("[Auth] User upserted.");

          const user = await db.getUserByOpenId(uid);
          if (!user) throw new Error("Failed to create user");
          console.log("[Auth] User retrieved from DB.");

          // Create session cookie
          console.log("[Auth] Creating session token...");
          const sessionToken = await sdk.createSessionToken(uid, { name: user.name || "" });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          console.log("[Auth] Setting session cookie...");
          
          (ctx.res as any).cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          console.log("[Auth] Login successful.");
          return { success: true, user };
        } catch (error: any) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error("[Auth] Firebase login failed:", msg);
          if (error.stack) console.error(error.stack);
          throw new Error(`Firebase token verification failed: ${msg}`);
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  people: peopleRouter,
  patients: peopleRouter, 

  events: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const meAsPersonInAnyFacility = await db.getPersonByEmail(ctx.user.email || "");
      const ownerId = meAsPersonInAnyFacility?.userId || ctx.user.id;
      
      const allEvents = await db.getDetectionEventsByUserId(ownerId, 500);
      
      if (ctx.user.role === "admin") return allEvents;

      const allPeople = await db.getPeopleByUserId(ownerId);
      const meAsPerson = allPeople.find(p => p.email === ctx.user.email);
      
      if (!meAsPerson) return [];

      if (ctx.user.role === "doctor") {
        const myPatientIds = allPeople.filter(p => p.assignedDoctorId === meAsPerson.id).map(p => p.id);
        return allEvents.filter(e => e.personId && myPatientIds.includes(e.personId));
      }

      if (ctx.user.role === "nurse") {
        const myPatientIds = allPeople.filter(p => p.assignedNurseId === meAsPerson.id).map(p => p.id);
        return allEvents.filter(e => e.personId && myPatientIds.includes(e.personId));
      }

      if (ctx.user.role === "patient") {
        return allEvents.filter(e => e.personId === meAsPerson.id);
      }

      return [];
    }),
    getByPatient: protectedProcedure
      .input(z.object({ patientId: z.string() }))
      .query(({ input }) => db.getDetectionEventsByPatientId(input.patientId, 500)),
    log: protectedProcedure
      .input(z.object({
        patientId: z.string().optional(),
        personId: z.string().optional(),
        eventType: z.enum(["patient present", "patient absent", "unknown person detected", "person recognized"]),
        severity: z.enum(["info", "warning", "alert"]),
        description: z.string().optional(),
        detectedFaceDescriptor: z.unknown().optional(),
        matchConfidence: z.string().optional(),
        roomId: z.string().optional(),
        isAuthorized: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const event = await db.logDetectionEvent({
          userId: ctx.user.id,
          personId: input.personId ?? input.patientId ?? null,
          eventType: input.eventType,
          severity: input.severity,
          description: input.description ?? null,
          detectedFaceDescriptor: input.detectedFaceDescriptor ?? null,
          matchConfidence: input.matchConfidence ?? null,
          roomId: input.roomId ?? null,
          isAuthorized: input.isAuthorized ?? 1,
          timestamp: new Date().toISOString(),
        });

        if (input.eventType === "unknown person detected" && input.severity === "alert") {
          await notifyOwner({
            title: "Unknown Person Detected",
            content: `An unknown person has been detected in room ${input.roomId || "unknown"}. Please investigate immediately.`,
          });
          await db.createAlertLog({
            userId: ctx.user.id,
            detectionEventId: event.id,
            alertType: "unknown person detected",
            severity: "alert",
            title: "Unknown Person Detected",
            message: `Unknown person detected in room ${input.roomId || "unknown"}`,
            roomId: input.roomId ?? null,
          });
        } else if (input.eventType === "patient absent") {
          await notifyOwner({
            title: "Patient Missing",
            content: `Patient in room ${input.roomId || "unknown"} is no longer detected. Please check immediately.`,
          });
          await db.createAlertLog({
            userId: ctx.user.id,
            detectionEventId: event.id,
            alertType: "patient missing",
            severity: "alert",
            title: "Patient Missing",
            message: `Patient missing from room ${input.roomId || "unknown"}`,
            roomId: input.roomId ?? null,
          });
        } else if (input.eventType === "person recognized") {
          await db.createAlertLog({
            userId: ctx.user.id,
            detectionEventId: event.id,
            alertType: "person recognized",
            severity: "info",
            title: "Known Person Entered",
            message: input.description || `Known person recognized in room ${input.roomId || "unknown"}`,
            roomId: input.roomId ?? null,
          });
        } else if (input.eventType === "patient present") {
          await db.createAlertLog({
            userId: ctx.user.id,
            detectionEventId: event.id,
            alertType: "person recognized", // Map to same general type for displaying
            severity: "info",
            title: "Patient Present",
            message: input.description || `Patient confirmed present in room ${input.roomId || "unknown"}`,
            roomId: input.roomId ?? null,
          });
        }

        // Logic for unauthorized access alert
        if (input.isAuthorized === 0) {
          await notifyOwner({
            title: "Unauthorized Access Detected",
            content: `An unauthorized person has entered room ${input.roomId || "unknown"}.`,
          });
          await db.createAlertLog({
            userId: ctx.user.id,
            detectionEventId: event.id,
            alertType: "unknown person detected",
            severity: "alert",
            title: "Unauthorized Entry",
            message: input.description || `Unauthorized person detected in room ${input.roomId || "unknown"}`,
            roomId: input.roomId ?? null,
          });
        }

        return event;
      }),
  }),

  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const meAsPersonInAnyFacility = await db.getPersonByEmail(ctx.user.email || "");
      const ownerId = meAsPersonInAnyFacility?.userId || ctx.user.id;

      const allAlerts = await db.getAlertLogsByUserId(ownerId, 500);
      
      if (ctx.user.role === "admin") return allAlerts;

      const allPeople = await db.getPeopleByUserId(ownerId);
      const meAsPerson = allPeople.find(p => p.email === ctx.user.email);
      
      if (!meAsPerson) return [];

      const allEvents = await db.getDetectionEventsByUserId(ownerId, 1000);

      if (ctx.user.role === "doctor") {
        const myPatientIds = allPeople.filter(p => p.assignedDoctorId === meAsPerson.id).map(p => p.id);
        return allAlerts.filter(a => {
          const event = allEvents.find(e => e.id === a.detectionEventId);
          return event?.personId && myPatientIds.includes(event.personId);
        });
      }

      if (ctx.user.role === "nurse") {
        const myPatientIds = allPeople.filter(p => p.assignedNurseId === meAsPerson.id).map(p => p.id);
        return allAlerts.filter(a => {
          const event = allEvents.find(e => e.id === a.detectionEventId);
          return event?.personId && myPatientIds.includes(event.personId);
        });
      }

      if (ctx.user.role === "patient") {
        return allAlerts.filter(a => {
          const event = allEvents.find(e => e.id === a.detectionEventId);
          return event?.personId === meAsPerson.id;
        });
      }

      return [];
    }),
  }),
});

export type AppRouter = typeof appRouter;
