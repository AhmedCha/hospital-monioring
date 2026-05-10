
import "dotenv/config";
import { adminFirestore, adminAuth } from "../_core/firebase";

async function fixTestAccounts() {
  console.log("Fixing test accounts document IDs...");

  // 1. Fix Doctor
  const doctorEmail = "doctor@hospital.com";
  const doctorAuth = await adminAuth.getUserByEmail(doctorEmail);
  const doctorUid = doctorAuth.uid;
  console.log(`Doctor UID: ${doctorUid}`);

  const usersRef = adminFirestore.collection("users");
  
  // Create/Update the document with the correct UID as the ID
  await usersRef.doc(doctorUid).set({
    email: doctorEmail,
    name: "Dr. Smith",
    role: "doctor",
    openId: doctorUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  }, { merge: true });
  console.log("Fixed doctor document ID.");

  // 2. Fix Nurse
  const nurseEmail = "nurse@hospital.com";
  const nurseAuth = await adminAuth.getUserByEmail(nurseEmail);
  const nurseUid = nurseAuth.uid;
  console.log(`Nurse UID: ${nurseUid}`);

  await usersRef.doc(nurseUid).set({
    email: nurseEmail,
    name: "Nurse Joy",
    role: "nurse",
    openId: nurseUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  }, { merge: true });
  console.log("Fixed nurse document ID.");

  // 3. Fix Admin
  const adminEmail = "firas@mail.com";
  try {
    const adminAuthRecord = await adminAuth.getUserByEmail(adminEmail);
    const adminUid = adminAuthRecord.uid;
    console.log(`Admin UID: ${adminUid}`);
    await usersRef.doc(adminUid).set({
      role: "admin",
      openId: adminUid,
      email: adminEmail
    }, { merge: true });
    console.log("Fixed admin document ID.");
  } catch (e) {
    console.log("Admin auth user might not exist yet if they haven't logged in with this email.");
  }

  console.log("Fix complete!");
  process.exit(0);
}

fixTestAccounts().catch(err => {
  console.error(err);
  process.exit(1);
});
