import { describe, expect, it } from "vitest";
import {
  HumanLegApiError,
  HumanLegClient,
  canonicalJson,
  sha256Canonical,
} from "../src/index.js";

describe("HumanLegClient", () => {
  it("adds authorization and idempotency headers", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new HumanLegClient({
      baseUrl: "https://sandbox.humanleg.ai/",
      token: "test-token",
      idempotencyKey: () => "idem-12345678",
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(
          JSON.stringify({
            id: "quote-1",
            rewardAtomic: 20_000_000,
            displayAudCents: 3_000,
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        );
      },
    });

    await client.createFeeQuote({
      rewardAtomic: 20_000_000,
      displayAudCents: 3_000,
    });
    expect(calls[0]?.url).toBe("https://sandbox.humanleg.ai/v1/fee-quotes");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("idempotency-key")).toBe("idem-12345678");
  });

  it("returns structured API errors", async () => {
    const client = new HumanLegClient({
      baseUrl: "https://sandbox.humanleg.ai",
      token: "test-token",
      fetch: async () =>
        new Response(
          JSON.stringify({
            title: "Blocked",
            code: "P_FINANCIAL_VALUE_TRANSFER",
          }),
          {
            status: 422,
          },
        ),
    });
    await expect(
      client.getTask("task-1"),
    ).rejects.toMatchObject<HumanLegApiError>({
      status: 422,
      problem: { code: "P_FINANCIAL_VALUE_TRANSFER" },
    });
  });
});

describe("exact-content helpers", () => {
  it("canonicalizes object keys recursively", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
  });

  it("creates a stable SHA-256 hash", async () => {
    expect(await sha256Canonical({ b: 2, a: 1 })).toBe(
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    );
  });
});
