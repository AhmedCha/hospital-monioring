import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { storagePut } from "../storage";
import { sendEmail } from "../email";

export const peopleRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      // 1. Find the "Person" record associated with the logged-in user to find their facility/owner
      const meAsPersonInAnyFacility = await db.getPersonByEmail(ctx.user.email || "");
      
      // If we can't find a person record, we might be the Admin themselves
      const ownerId = meAsPersonInAnyFacility?.userId || ctx.user.id;
      
      // 2. Fetch all people belonging to this facility/owner
      const allPeople = await db.getPeopleByUserId(ownerId);
      
      if (ctx.user.role === "admin") {
        return allPeople;
      }

      // Find the specific person record for the current user WITHIN this facility
      const meAsPerson = allPeople.find(p => p.email === ctx.user.email);
      
      if (!meAsPerson) {
        return [];
      }

      if (ctx.user.role === "doctor") {
        return allPeople.filter(p => 
          p.id === meAsPerson.id || // See self
          p.role === "doctor" || // See all doctors
          p.role === "nurse" || // See all nurses
          (p.role === "patient" && p.assignedDoctorId === meAsPerson.id) // See assigned patients
        );
      }

      if (ctx.user.role === "nurse") {
        return allPeople.filter(p => 
          p.id === meAsPerson.id || // See self
          p.role === "doctor" || // See all doctors
          p.role === "nurse" || // See all nurses
          (p.role === "patient" && p.assignedNurseId === meAsPerson.id) // See assigned patients
        );
      }

      if (ctx.user.role === "patient") {
        return allPeople.filter(p => p.id === meAsPerson.id);
      }

      return [];
    }),

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
      email: z.string().email().optional().nullable(),
      roomId: z.string().optional().nullable(),
      photoUrl: z.string().optional(),
      photoStorageKey: z.string().optional(),
      enrolledFaceDescriptor: z.unknown().optional(),
      assignedDoctorId: z.string().optional().nullable(),
      assignedNurseId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isDoctor = ctx.user.role === "doctor";
      const isAdmin = ctx.user.role === "admin";
      
      if (!isAdmin && !isDoctor) {
        throw new Error("Only admins and doctors can register new patients.");
      }

      // Find the facility owner (Admin)
      const meAsPersonInAnyFacility = await db.getPersonByEmail(ctx.user.email || "");
      const ownerId = meAsPersonInAnyFacility?.userId || ctx.user.id;
      
      let assignedDoctorId = input.assignedDoctorId ?? null;
      
      // If a doctor is creating, auto-assign them as the doctor
      if (isDoctor && meAsPersonInAnyFacility) {
        assignedDoctorId = meAsPersonInAnyFacility.id;
      }

      return db.createPerson({
        userId: ownerId, // All records belong to the facility owner
        name: input.name,
        role: input.role,
        email: input.email ?? null,
        roomId: input.roomId ?? null,
        photoUrl: input.photoUrl ?? null,
        photoStorageKey: input.photoStorageKey ?? null,
        enrolledFaceDescriptor: input.enrolledFaceDescriptor ?? null,
        assignedDoctorId: assignedDoctorId,
        assignedNurseId: input.assignedNurseId ?? null,
        isActive: 1,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(["patient", "doctor", "nurse", "other"]).optional(),
      email: z.string().email().optional().nullable(),
      roomId: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
      photoStorageKey: z.string().optional().nullable(),
      enrolledFaceDescriptor: z.unknown().optional().nullable(),
      isActive: z.number().optional(),
      assignedDoctorId: z.string().optional().nullable(),
      assignedNurseId: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const personToUpdate = await db.getPersonById(input.id);
      if (!personToUpdate) throw new Error("Person not found");

      const meAsPersonInAnyFacility = await db.getPersonByEmail(ctx.user.email || "");
      const ownerId = meAsPersonInAnyFacility?.userId || ctx.user.id;
      const allPeopleInFacility = await db.getPeopleByUserId(ownerId);
      const meAsPerson = allPeopleInFacility.find(p => p.email === ctx.user.email);

      if (ctx.user.role === "admin") {
        return db.updatePerson(input.id, {
          name: input.name,
          role: input.role,
          email: input.email === undefined ? undefined : (input.email ?? null),
          roomId: input.roomId === undefined ? undefined : (input.roomId ?? null),
          photoUrl: input.photoUrl === undefined ? undefined : (input.photoUrl ?? null),
          photoStorageKey: input.photoStorageKey === undefined ? undefined : (input.photoStorageKey ?? null),
          enrolledFaceDescriptor: input.enrolledFaceDescriptor === undefined ? undefined : (input.enrolledFaceDescriptor ?? null),
          isActive: input.isActive,
          assignedDoctorId: input.assignedDoctorId === undefined ? undefined : (input.assignedDoctorId ?? null),
          assignedNurseId: input.assignedNurseId === undefined ? undefined : (input.assignedNurseId ?? null),
        });
      }

      if (ctx.user.role === "doctor") {
        if (meAsPerson && personToUpdate.role === "patient" && personToUpdate.assignedDoctorId === meAsPerson.id) {
          // Doctors can only update the assigned nurse
          return db.updatePerson(input.id, {
            assignedNurseId: input.assignedNurseId === undefined ? undefined : (input.assignedNurseId ?? null),
          });
        }
        throw new Error("You can only manage nurses for your assigned patients.");
      }

      throw new Error("You do not have permission to update records.");
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Only admins can remove patients or staff.");
      }
      return db.deletePerson(input.id);
    }),

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
            email: null,
            assignedDoctorId: null,
            assignedNurseId: null,
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

  sendAlertEmail: protectedProcedure
    .input(z.object({
      recipientEmail: z.string().email(),
      subject: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await sendEmail({
        to: input.recipientEmail,
        subject: input.subject,
        text: input.message,
      });
    }),
});

export const patientsRouter = peopleRouter;
