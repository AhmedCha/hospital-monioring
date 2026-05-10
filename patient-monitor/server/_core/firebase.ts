import admin from "firebase-admin";

const ENV = {
  firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
  firebaseStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  ownerOpenId: process.env.OWNER_OPENID ?? "",
};

const PROJECT_ID = ENV.firebaseProjectId;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("[Firebase Admin] Initializing with service account...");
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      // Fix for private key newlines if they are escaped in the .env string
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: ENV.firebaseStorageBucket
      });
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
