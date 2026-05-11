
import "dotenv/config";
import { adminFirestore } from "../_core/firebase";

async function checkIds() {
  const adminSnap = await adminFirestore.collection("users").where("email", "==", "firas@mail.com").get();
  const adminId = adminSnap.docs[0].id;
  console.log("Admin UID:", adminId);

  const peopleSnap = await adminFirestore.collection("people").get();
  peopleSnap.forEach(doc => {
    const data = doc.data();
    console.log(`${data.name} (${data.role}) - userId: ${data.userId} - ID: ${doc.id}`);
  });
  process.exit(0);
}

checkIds();
