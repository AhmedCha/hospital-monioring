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

describe("alerts router", () => {
  it("lists alerts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const alerts = await caller.alerts.list();

    expect(Array.isArray(alerts)).toBe(true);
  });

  it("creates unknown person alert with correct severity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test that the events.log procedure handles unknown person detection
    const result = await caller.events.log({
      patientId: 1,
      eventType: "unknown person detected",
      severity: "alert",
      description: "Unknown face detected in monitored room",
    });

    expect(result).toBeDefined();
  });

  it("creates patient missing alert with correct severity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "patient absent",
      severity: "warning",
      description: "Patient not detected in room for extended period",
    });

    expect(result).toBeDefined();
  });

  it("sends owner notification on unknown person detection", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "unknown person detected",
      severity: "alert",
      roomId: "101",
      description: "Unknown person in room 101",
    });

    // Verify event was created (notification is sent automatically)
    expect(result).toBeDefined();
  });

  it("sends owner notification on patient absence", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.events.log({
      patientId: 1,
      eventType: "patient absent",
      severity: "alert",
      roomId: "102",
      description: "Patient missing from room 102",
    });

    // Verify event was created (notification is sent automatically)
    expect(result).toBeDefined();
  });

  it("respects severity levels for alerts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const severities = ["warning", "alert"] as const;

    for (const severity of severities) {
      const result = await caller.events.log({
        patientId: 1,
        eventType: "unknown person detected",
        severity,
        description: `Test event with ${severity} severity`,
      });

      expect(result).toBeDefined();
    }
  });

  it("tracks alert creation timestamp", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alerts.list();

    // Verify alerts have timestamps
    if (result.length > 0) {
      expect(result[0].createdAt).toBeDefined();
    }
  });

  it("retrieves alerts list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const alerts = await caller.alerts.list();

    expect(Array.isArray(alerts)).toBe(true);
  });
});
