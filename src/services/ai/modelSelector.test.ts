import { describe, expect, it, vi } from "vitest";
import { ModelSelector } from "./modelSelector.js";
import * as membership from "../membership.service.js";

describe("ModelSelector", () => {
  it("selects free model for free users", async () => {
    vi.spyOn(membership, "membershipFor").mockResolvedValueOnce({ type: "expired", status: "expired", active: false, readOnly: true, isAdmin: false, canGenerate: false, canCreateProjects: false, trialStartedAt: null, trialExpiresAt: null, proStartedAt: null, accessExpiresAt: null, lastPaymentAt: null, daysRemaining: 0, trialDaysRemaining: 0, totalPayments: 0 });
    const selector = new ModelSelector();
    const result = await selector.forUser("user-1");
    expect(result.membership).toBe("free");
  });
});