import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { storagePut } from "../storage";

export const peopleRouter = router({
  list: protectedProcedure
    .input(z.object({ role: z.enum(["patient", "doctor", "nurse", "other"]).optional() }).optional())
    .query(({ ctx, input }) =>
      db.getPeopleByUserId(ctx.user.id, input?.role)
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => db.getPersonById(input.id)),

  getRooms: protectedProcedure
    .query(async ({ ctx }) => {
      const people = await db.getPeopleByUserId(ctx.user.id);
      const rooms = Array.from(new Set(people.map((p) => p.roomId).filter(Boolean)));
      return rooms.sort();
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      role: z.enum(["patient", "doctor", "nurse", "other"]),
      roomId: z.string().optional().nullable(),
      photoUrl: z.string().optional(),
      photoStorageKey: z.string().optional(),
      enrolledFaceDescriptor: z.unknown().optional(),
    }))
    .mutation(({ ctx, input }) =>
      db.createPerson({
        userId: ctx.user.id,
        isActive: 1,
        ...input,
      })
    ),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(["patient", "doctor", "nurse", "other"]).optional(),
      roomId: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
      photoStorageKey: z.string().optional().nullable(),
      enrolledFaceDescriptor: z.unknown().optional().nullable(),
      isActive: z.number().optional(),
    }))
    .mutation(({ input }) =>
      db.updatePerson(input.id, {
        name: input.name,
        role: input.role,
        roomId: input.roomId,
        photoUrl: input.photoUrl,
        photoStorageKey: input.photoStorageKey,
        enrolledFaceDescriptor: input.enrolledFaceDescriptor,
        isActive: input.isActive,
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => db.deletePerson(input.id)),

  uploadPhoto: protectedProcedure
    .input(z.object({
      personId: z.string(),
      photoBase64: z.string().optional(),
      photoUrl: z.string().optional(),
      photoStorageKey: z.string().optional(),
      faceDescriptor: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify person belongs to user
        const person = await db.getPersonById(input.personId);
        if (!person || person.userId !== ctx.user.id) {
          throw new Error("Person not found or unauthorized");
        }

        let finalPhotoUrl = input.photoUrl;
        let finalPhotoKey = input.photoStorageKey;

        // If base64 is provided and we don't have a URL yet, upload it
        if (input.photoBase64 && !finalPhotoUrl) {
          const base64Data = input.photoBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          const filename = `person-${input.personId}-${Date.now()}.jpg`;
          const { url, key } = await storagePut(
            `people-photos/${filename}`,
            buffer,
            "image/jpeg"
          );
          finalPhotoUrl = url;
          finalPhotoKey = key;
        }

        if (!finalPhotoUrl) {
          throw new Error("No photo provided for enrollment");
        }

        const descriptorArray = Array.from(input.faceDescriptor);

        await db.updatePerson(input.personId, {
          photoUrl: finalPhotoUrl,
          photoStorageKey: finalPhotoKey,
          enrolledFaceDescriptor: descriptorArray,
        });

        return {
          success: true,
          photoUrl: finalPhotoUrl,
          message: "Photo enrolled successfully",
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to upload photo";
        throw new Error(errorMsg);
      }
    }),

  syncFirebasePatients: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Since everything is on Firebase now, we use the Admin SDK 
      // instead of fetch to bypass rules and avoid "Unauthorized" errors.
      const snapshot = await db.getFirebasePatientsMeta();
      
      if (!snapshot) return { success: true, added: 0 };

      const data = snapshot;

      const existingPeople = await db.getPeopleByUserId(ctx.user.id, "patient");
      let added = 0;

      const patientsToSync = Object.entries(data).map(([firebaseId, value]: [string, any]) => ({
        firebaseId,
        name: value.name || "Unknown",
        roomId: value.roomId || null,
      }));

      for (const p of patientsToSync) {
        const exists = existingPeople.find(ep => 
          ep.firebaseId === p.firebaseId || (!ep.firebaseId && ep.name === p.name)
        );

        if (!exists) {
          await db.createPerson({
            userId: ctx.user.id,
            name: p.name,
            role: "patient",
            roomId: p.roomId,
            firebaseId: p.firebaseId,
            photoUrl: null,
            photoStorageKey: null,
            enrolledFaceDescriptor: null,
            isActive: 1,
          });
          added++;
        } else if (!exists.firebaseId) {
          await db.updatePerson(exists.id, {
            firebaseId: p.firebaseId,
          });
        }
      }
      
      return { success: true, added };
    }),
});

export const patientsRouter = peopleRouter;
