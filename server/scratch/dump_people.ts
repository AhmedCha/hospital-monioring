
import "dotenv/config";
import { adminFirestore } from "../_core/firebase";

async function dumpPeople() {
  const snap = await adminFirestore.collection('people').get();
  snap.forEach(doc => {
    const data = doc.data();
    console.log(JSON.stringify({
      id: doc.id,
      name: data.name,
      role: data.role,
      email: data.email,
      assignedDoctorId: data.assignedDoctorId,
      assignedNurseId: data.assignedNurseId
    }));
  });
  process.exit(0);
}

dumpPeople();
