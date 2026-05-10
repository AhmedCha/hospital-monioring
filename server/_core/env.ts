export const ENV = {
  cookieSecret: process.env.OAUTH_COOKIE_SECRET ?? "hospital-monitor-default-secret-32chars",
  isProduction: process.env.NODE_ENV === "production",
  firebaseProjectId: process.env.VITE_FIREBASE_PROJECT_ID ?? "",
  firebaseStorageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  ownerOpenId: process.env.OWNER_OPENID ?? "",
};
