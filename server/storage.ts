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
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bucket = admin.storage().bucket();
  const file = bucket.file(key);

  try {
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
    await file.save(buffer, {
      metadata: { 
        contentType,
        cacheControl: 'public, max-age=31536000'
      },
    });

    // Generate a signed URL that effectively never expires
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2100'
    });

    return { key, url };
  } catch (error) {
    console.error("Firebase storage upload error:", error);
    throw new Error(`Firebase storage upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
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
