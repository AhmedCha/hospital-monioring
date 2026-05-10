import type { Express } from "express";

/**
 * Previously a Manus storage proxy. Now a no-op stub.
 * Photo uploads are stored directly via Firebase Storage.
 */
export function registerStorageProxy(_app: Express) {
  // No-op — Manus storage removed. Use Firebase Storage instead.
}
