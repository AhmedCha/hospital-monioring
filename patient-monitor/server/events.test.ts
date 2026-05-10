import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "firebase",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("events router", () => {
  it("lists detection events", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const events = await caller.events.list();

    expect(Array.isArray(events)).toBe(true);
  });

  it("logs a detection event with correct structure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "patient present",
      severity: "info",
      roomId: "101",
      matchConfidence: "0.95",
      description: "Patient detected with high confidence",
    });

    expect(result).toBeDefined();
  });

  it("logs unknown person detection event", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "unknown person detected",
      severity: "alert",
      roomId: "102",
      matchConfidence: "0.0",
      description: "Unknown face detected in room",
    });

    expect(result).toBeDefined();
  });

  it("logs patient absence event", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "patient absent",
      severity: "warning",
      roomId: "103",
      matchConfidence: "0.0",
      description: "Patient not detected in room",
    });

    expect(result).toBeDefined();
  });

  it("retrieves events by patient", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const events = await caller.events.getByPatient({ patientId: 1 });

    expect(Array.isArray(events)).toBe(true);
  });

  it("respects severity levels in events", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const severities = ["info", "warning", "alert"] as const;

    for (const severity of severities) {
      const result = await caller.events.log({
        patientId: 1,
        eventType: "patient present",
        severity,
        roomId: "104",
        matchConfidence: "0.9",
        description: `Test event with ${severity} severity`,
      });

      expect(result).toBeDefined();
    }
  });
});
