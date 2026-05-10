import "dotenv/config";
import { adminFirestore, adminAuth } from "../_core/firebase";

async function setupAccounts() {
  console.log("Starting account setup...");

  // 1. Setup Admin
  const adminEmail = "firas@mail.com";
  const usersRef = adminFirestore.collection("users");
  const adminSnapshot = await usersRef.where("email", "==", adminEmail).get();
  
  if (!adminSnapshot.empty) {
    const adminId = adminSnapshot.docs[0].id;
    await usersRef.doc(adminId).update({ role: "admin" });
    console.log(`Updated ${adminEmail} to admin.`);
  } else {
    // Create placeholder user if doesn't exist
    await usersRef.add({
      email: adminEmail,
      name: "Firas",
      role: "admin",
      openId: "placeholder-admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    });
    console.log(`Created admin account for ${adminEmail}.`);
  }

  // 2. Create Doctor Account
  const doctorEmail = "doctor@hospital.com";
  const doctorPassword = "Hospital123!";
  
  // Create Auth User
  try {
    await adminAuth.createUser({
      email: doctorEmail,
      password: doctorPassword,
      displayName: "Dr. Smith",
    });
    console.log(`Created Auth user for ${doctorEmail}`);
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      console.log(`Auth user for ${doctorEmail} already exists.`);
    } else {
      console.error(`Error creating auth user: ${e.message}`);
    }
  }

  const doctorSnapshot = await usersRef.where("email", "==", doctorEmail).get();
  let doctorId;
  if (doctorSnapshot.empty) {
    const doc = await usersRef.add({
      email: doctorEmail,
      name: "Dr. Smith",
      role: "doctor",
      openId: "test-doctor-id",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    });
    doctorId = doc.id;
    console.log(`Created doctor user: ${doctorEmail}`);
  } else {
    doctorId = doctorSnapshot.docs[0].id;
  }

  // Create Doctor Person (for assignments)
  const peopleRef = adminFirestore.collection("people");
  const docPersonSnapshot = await peopleRef.where("email", "==", doctorEmail).get();
  if (docPersonSnapshot.empty) {
    await peopleRef.add({
      userId: doctorId, // Link to some owner or use it as its own
      name: "Dr. Smith",
      role: "doctor",
      email: doctorEmail,
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Created doctor person record.`);
  }

  // 3. Create Nurse Account
  const nurseEmail = "nurse@hospital.com";
  const nursePassword = "Hospital123!";

  // Create Auth User
  try {
    await adminAuth.createUser({
      email: nurseEmail,
      password: nursePassword,
      displayName: "Nurse Joy",
    });
    console.log(`Created Auth user for ${nurseEmail}`);
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      console.log(`Auth user for ${nurseEmail} already exists.`);
    } else {
      console.error(`Error creating auth user: ${e.message}`);
    }
  }

  const nurseSnapshot = await usersRef.where("email", "==", nurseEmail).get();
  let nurseId;
  if (nurseSnapshot.empty) {
    const doc = await usersRef.add({
      email: nurseEmail,
      name: "Nurse Joy",
      role: "nurse",
      openId: "test-nurse-id",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignedIn: new Date().toISOString(),
    });
    nurseId = doc.id;
    console.log(`Created nurse user: ${nurseEmail}`);
  } else {
    nurseId = nurseSnapshot.docs[0].id;
  }

  // Create Nurse Person (for assignments)
  const nursePersonSnapshot = await peopleRef.where("email", "==", nurseEmail).get();
  if (nursePersonSnapshot.empty) {
    await peopleRef.add({
      userId: nurseId,
      name: "Nurse Joy",
      role: "nurse",
      email: nurseEmail,
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`Created nurse person record.`);
  }

  console.log("Setup complete!");
  process.exit(0);
}

setupAccounts().catch(err => {
  console.error(err);
  process.exit(1);
});
