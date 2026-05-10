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

      // Check if the string is likely base64 encoded (doesn't start with '{')
      if (!saString.startsWith('{')) {
        try {
          console.log("[Firebase Admin] Assuming service account is Base64 encoded. Decoding...");
          saString = Buffer.from(saString, 'base64').toString('utf8');
        } catch (e) {
          console.error("[Firebase Admin] Failed to decode Base64 service account.");
        }
      }
      
      try {
        console.log("[Firebase Admin] Attempting to parse service account...");
        const serviceAccount = JSON.parse(saString);
        
        // Fix for private key newlines
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          // If the string literally contains "\n" (escaped), replace it with actual newlines
          if (serviceAccount.private_key.includes('\\n')) {
            console.log("[Firebase Admin] Fixing escaped newlines in private key...");
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
          storageBucket: ENV.firebaseStorageBucket
        });
        console.log("[Firebase Admin] Initialization successful.");
      } catch (parseError: any) {
        console.error("[Firebase Admin] JSON Parse failed:", parseError.message);
        console.error("[Firebase Admin] Please ensure your FIREBASE_SERVICE_ACCOUNT is valid JSON. If it contains newlines, consider base64 encoding it.");
        // We do not throw here to prevent server crash on cold start. 
        // Firebase services will fail when used, which gives a better TRPC error.
      }
    } else {
      console.log("[Firebase Admin] Initializing with Project ID fallback:", PROJECT_ID);
      admin.initializeApp({
        projectId: PROJECT_ID,
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: ENV.firebaseStorageBucket
      });
    }
  } catch (error) {
    console.error("[Firebase Admin] Initialization failed:", error);
  }
}

let _adminAuth: admin.auth.Auth;
let _adminDb: admin.database.Database;
let _adminFirestore: admin.firestore.Firestore;

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get: (target, prop) => {
    if (!_adminAuth) _adminAuth = admin.auth();
    const value = _adminAuth[prop as keyof typeof _adminAuth];
    return typeof value === "function" ? value.bind(_adminAuth) : value;
  }
});

export const adminDb = new Proxy({} as admin.database.Database, {
  get: (target, prop) => {
    if (!_adminDb) _adminDb = admin.database();
    const value = _adminDb[prop as keyof typeof _adminDb];
    return typeof value === "function" ? value.bind(_adminDb) : value;
  }
});

export const adminFirestore = new Proxy({} as admin.firestore.Firestore, {
  get: (target, prop) => {
    if (!_adminFirestore) _adminFirestore = admin.firestore();
    const value = _adminFirestore[prop as keyof typeof _adminFirestore];
    return typeof value === "function" ? value.bind(_adminFirestore) : value;
  }
});

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
