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
          const { uid, name, email } = await verifyFirebaseToken(input.idToken);

          // Sync user to Firestore
          await db.upsertUser({
            openId: uid,
            name: name || email || "Anonymous",
            email: email || null,
            loginMethod: "firebase",
            lastSignedIn: new Date().toISOString(),
          });

          const user = await db.getUserByOpenId(uid);
          if (!user) throw new Error("Failed to create user");

          // Create session cookie
          const sessionToken = await sdk.createSessionToken(uid, { name: user.name || "" });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: ONE_YEAR_MS,
          });

          return { success: true, user };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error("[Auth] Firebase login failed:", msg);
          throw new Error(`Firebase token verification failed: ${msg}`);
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  people: peopleRouter,
  patients: peopleRouter, 

  events: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getDetectionEventsByUserId(ctx.user.id, 500)
    ),
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
      }))
      .mutation(async ({ ctx, input }) => {
        const event = await db.logDetectionEvent({
          userId: ctx.user.id,
          personId: input.personId ?? input.patientId ?? null,
          eventType: input.eventType,
          severity: input.severity,
          description: input.description ?? null,
          detectedFaceDescriptor: input.detectedFaceDescriptor,
          matchConfidence: input.matchConfidence ?? null,
          roomId: input.roomId ?? null,
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
        } else if (input.eventType === "patient absent" && input.severity === "alert") {
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
        }

        return event;
      }),
  }),

  alerts: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getAlertLogsByUserId(ctx.user.id, 500)
    ),
  }),
});

export type AppRouter = typeof appRouter;
