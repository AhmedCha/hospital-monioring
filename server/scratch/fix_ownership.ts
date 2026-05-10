
import "dotenv/config";
import { adminFirestore } from "../_core/firebase";

async function fixPeopleOwnership() {
  const adminSnap = await adminFirestore.collection("users").where("email", "==", "firas@mail.com").get();
  if (adminSnap.empty) {
    console.error("Admin not found");
    process.exit(1);
  }
  const adminId = adminSnap.docs[0].id;
  console.log("Admin ID:", adminId);

  const peopleSnap = await adminFirestore.collection("people").get();
  for (const doc of peopleSnap.docs) {
    const person = doc.data();
    if (person.userId !== adminId) {
      await doc.ref.update({ userId: adminId });
      console.log(`Updated person ${person.name} to belong to Admin.`);
    }
  }

  process.exit(0);
}

fixPeopleOwnership();
