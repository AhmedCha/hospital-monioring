import admin from "firebase-admin";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = Math.random().toString(36).substring(2, 10);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "image/jpeg",
): Promise<{ key: string; url: string }> {
  // BACKUP PLAN: Convert to Base64 Data URL instead of uploading to Firebase Storage
  // This allows the app to work without a paid Firebase Storage plan.
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${contentType};base64,${base64}`;
  
  const key = `base64_${Math.random().toString(36).substring(7)}`;
  
  console.log(`[Storage] Using Base64 fallback (size: ${Math.round(buffer.length / 1024)}KB)`);
  
  return { 
    key, 
    url: dataUrl 
  };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(relKey);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '01-01-2100'
  });
  return { key: relKey, url };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { url } = await storageGet(relKey);
  return url;
}
