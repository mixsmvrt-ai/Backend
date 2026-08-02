import { describe, expect, it, vi } from "vitest";
import { RetryManager } from "./retryManager.js";
import { AiOrchestrationError } from "./types.js";

describe("RetryManager", () => {
  it("retries retryable failures", async () => {
    const manager = new RetryManager(2);
    const work = vi.fn()
      .mockRejectedValueOnce(new AiOrchestrationError("temp", "TEMP", 502, true))
      .mockResolvedValueOnce("ok");
    const result = await manager.run(work, (error) => error instanceof AiOrchestrationError && error.retryable);
    expect(result).toBe("ok");
    expect(work).toHaveBeenCalledTimes(2);
  });
});