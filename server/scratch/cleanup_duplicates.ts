
import "dotenv/config";
import { adminFirestore } from "../_core/firebase";

async function cleanupDuplicates() {
  const snap = await adminFirestore.collection('people').get();
  const seenNames = new Set();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.role === 'patient') {
      if (seenNames.has(data.name)) {
        console.log(`Deleting duplicate patient: ${data.name} (ID: ${doc.id})`);
        await doc.ref.delete();
      } else {
        seenNames.add(data.name);
      }
    }
  }
  
  console.log("Cleanup complete!");
  process.exit(0);
}

cleanupDuplicates();
