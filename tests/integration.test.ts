import { spawn, type ChildProcess } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HumanLegApiError, HumanLegClient } from "../packages/sdk/src/index.js";

const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;
let sandbox: ChildProcess;

async function waitForSandbox(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The sandbox may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("sandbox did not start");
}

beforeAll(async () => {
  sandbox = spawn(process.execPath, ["packages/sandbox/dist/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HUMANLEG_AGENT_TOKEN: "sandbox-agent-token",
    },
    stdio: "ignore",
  });
  await waitForSandbox();
});

afterAll(() => {
  sandbox.kill("SIGTERM");
});

describe("synthetic lifecycle", () => {
  const client = new HumanLegClient({ baseUrl, token: "sandbox-agent-token" });

  it("requires explicit funding and publication after exact approval", async () => {
    const quote = await client.createFeeQuote({
      rewardAtomic: 20_000_000,
      displayAudCents: 3_000,
    });
    const task = await client.createTask({
      feeQuoteId: quote.id,
      category: "REMOTE_VERIFICATION",
      title: "Verify a public checkout flow",
      instructions:
        "Use synthetic data to complete the supplied public checkout rubric.",
      evidenceRequirements: ["Completed synthetic rubric"],
      rewardAtomic: 20_000_000,
      displayAudCents: 3_000,
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      country: "AU",
      physicalPresenceRequired: false,
    });
    expect(task.status).toBe("DRAFT");
    expect(task.complianceReview?.decision).toBe("APPROVE");

    await client.createFundingIntent(task.id);
    const published = await client.publishTask(task.id, task.contentVersion);
    expect(published.status).toBe("OPEN");
  });

  it("fails closed for prohibited financial-value tasks", async () => {
    const quote = await client.createFeeQuote({
      rewardAtomic: 20_000_000,
      displayAudCents: 3_000,
    });
    const task = await client.createTask({
      feeQuoteId: quote.id,
      category: "REMOTE_VERIFICATION",
      title: "Buy a gift card",
      instructions:
        "Purchase a gift card and send the redemption details back to the agent.",
      evidenceRequirements: ["Gift card code"],
      rewardAtomic: 20_000_000,
      displayAudCents: 3_000,
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      country: "AU",
      physicalPresenceRequired: false,
    });
    expect(task.complianceReview?.decision).toBe("REJECT");
    expect(task.complianceReview?.reasonCode).toBe(
      "P_FINANCIAL_VALUE_TRANSFER",
    );
    await expect(
      client.createFundingIntent(task.id),
    ).rejects.toMatchObject<HumanLegApiError>({
      status: 409,
    });
  });
});

describe("MCP surface", () => {
  it("exposes create/read tools but hides settlement by default", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["packages/mcp-server/dist/index.js"],
      cwd: process.cwd(),
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        HUMANLEG_API_URL: baseUrl,
        HUMANLEG_AGENT_TOKEN: "sandbox-agent-token",
      },
      stderr: "ignore",
    });
    const mcp = new Client({ name: "humanleg-test", version: "0.1.0" });
    try {
      await mcp.connect(transport);
      const tools = await mcp.listTools();
      const names = tools.tools.map((tool) => tool.name);
      expect(names).toContain("humanleg_create_task");
      expect(names).toContain("humanleg_get_task");
      expect(names).not.toContain("humanleg_fund_task");
      expect(names).not.toContain("humanleg_publish_task");
    } finally {
      await mcp.close();
    }
  });
});
