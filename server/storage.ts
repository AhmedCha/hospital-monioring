import { ENV } from "./_core/env";
import * as fs from "fs";
import * as path from "path";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

// Ensure local upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), "client", "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const fileName = key.split("/").pop() || key;
  const filePath = path.join(UPLOAD_DIR, fileName);

  try {
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
    fs.writeFileSync(filePath, buffer);
    
    // Return the URL relative to the public folder
    const url = `/uploads/${fileName}`;
    return { key, url };
  } catch (error) {
    console.error("Local storage upload error:", error);
    throw new Error(`Local storage upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const fileName = relKey.split("/").pop() || relKey;
  const url = `/uploads/${fileName}`;
  return { key: relKey, url };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { url } = await storageGet(relKey);
  return url;
}
