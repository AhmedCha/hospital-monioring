import { jwtVerify, importX509, createRemoteJWKSet } from "jose";

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

// Use Google's JWKS endpoint (JSON Web Key Set) which is cleaner than X.509 certs
const GOOGLE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
);

// Cache the JWKS remote keyset (jose handles this automatically)
const JWKS = createRemoteJWKSet(GOOGLE_JWKS_URL, {
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
});

export type FirebaseTokenPayload = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

/**
 * Verify a Firebase ID token without a service account.
 * Uses Google's public JWKS endpoint to verify the JWT signature.
 * Works with both Google Sign-In and Email/Password Firebase tokens.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<FirebaseTokenPayload> {
  if (!PROJECT_ID) {
    throw new Error("VITE_FIREBASE_PROJECT_ID is not configured in .env");
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    algorithms: ["RS256"],
    audience: PROJECT_ID,
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
  });

  // Firebase puts the user ID in 'sub' (subject claim)
  const uid = payload.sub as string;
  if (!uid) {
    throw new Error("Firebase token missing user ID (sub claim)");
  }

  return {
    uid,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
    email_verified: payload.email_verified as boolean | undefined,
  };
}
