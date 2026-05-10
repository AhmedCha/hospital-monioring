import admin from "firebase-admin";

const ENV = {
  firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
  firebaseStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  ownerOpenId: process.env.OWNER_OPENID ?? "",
};

const PROJECT_ID = ENV.firebaseProjectId;

if (!admin.apps.length) {
  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountVar) {
      console.log("[Firebase Admin] Initializing with service account (Length:", serviceAccountVar.length, ")...");
      let saString = serviceAccountVar.trim();
      
      // Remove surrounding single or double quotes if present
      if ((saString.startsWith("'") && saString.endsWith("'")) || 
          (saString.startsWith('"') && saString.endsWith('"'))) {
        console.log("[Firebase Admin] Stripping surrounding quotes...");
        saString = saString.slice(1, -1);
      }
      
      try {
        const serviceAccount = JSON.parse(saString);
        
        // Fix for private key newlines if they are escaped in the .env string
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
          storageBucket: ENV.firebaseStorageBucket
        });
        console.log("[Firebase Admin] Initialization successful via service account.");
      } catch (parseError: any) {
        console.error("[Firebase Admin] JSON Parse failed:", parseError.message);
        console.error("[Firebase Admin] First 50 chars of string:", saString.substring(0, 50));
        throw parseError;
      }
    } else {
      console.log("[Firebase Admin] Initializing with Project ID fallback:", PROJECT_ID);
      admin.initializeApp({
        projectId: PROJECT_ID,
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: ENV.firebaseStorageBucket
      });
    }
    console.log(`[Firebase Admin] Initialization successful for bucket: ${ENV.firebaseStorageBucket}`);
  } catch (error) {
    console.error("[Firebase Admin] Initialization failed:", error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.database();
export const adminFirestore = admin.firestore();

export type FirebaseTokenPayload = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export async function verifyFirebaseToken(
  idToken: string
): Promise<FirebaseTokenPayload> {
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    name: decodedToken.name,
    picture: decodedToken.picture,
    email_verified: decodedToken.email_verified,
  };
}
