import admin from "firebase-admin";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
      });
    } else {
      admin.initializeApp({
        projectId: PROJECT_ID,
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
      });
    }
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
