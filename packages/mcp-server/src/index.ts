#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HumanLegApiError, HumanLegClient } from "@humanleg/sdk";
import { z } from "zod";

const baseUrl = process.env.HUMANLEG_API_URL ?? "http://127.0.0.1:8787";
const token = process.env.HUMANLEG_AGENT_TOKEN;
if (!token) {
  console.error(
    "HUMANLEG_AGENT_TOKEN is required. Use only a sandbox token in local demos.",
  );
  process.exit(1);
}

const client = new HumanLegClient({ baseUrl, token });
const server = new McpServer({ name: "humanleg", version: "0.1.0" });

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function failure(error: unknown) {
  if (error instanceof HumanLegApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { status: error.status, ...error.problem, message: error.message },
            null,
            2,
          ),
        },
      ],
    };
  }
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : "Unknown HumanLeg error",
      },
    ],
  };
}

server.registerTool(
  "humanleg_create_fee_quote",
  {
    title: "Create HumanLeg fee quote",
    description:
      "Create a short-lived synthetic fee quote before creating a task.",
    inputSchema: {
      rewardUsdc: z
        .number()
        .min(20)
        .describe("Worker reward in synthetic USDC."),
      displayAud: z
        .number()
        .positive()
        .describe("Human-readable AUD equivalent."),
    },
  },
  async ({ rewardUsdc, displayAud }) => {
    try {
      return result(
        await client.createFeeQuote({
          rewardAtomic: Math.round(rewardUsdc * 1_000_000),
          displayAudCents: Math.round(displayAud * 100),
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "humanleg_create_task",
  {
    title: "Create and review HumanLeg task",
    description:
      "Create a bounded task and run compliance review. This does not fund or publish the task.",
    inputSchema: {
      feeQuoteId: z.string().uuid(),
      title: z.string().min(3).max(160),
      instructions: z.string().min(10).max(10_000),
      evidenceRequirements: z.array(z.string().min(1)).min(1).max(10),
      rewardUsdc: z.number().min(20),
      displayAud: z.number().positive(),
      deadline: z.string().datetime(),
    },
  },
  async (input) => {
    try {
      return result(
        await client.createTask({
          feeQuoteId: input.feeQuoteId,
          category: "REMOTE_VERIFICATION",
          title: input.title,
          instructions: input.instructions,
          evidenceRequirements: input.evidenceRequirements,
          rewardAtomic: Math.round(input.rewardUsdc * 1_000_000),
          displayAudCents: Math.round(input.displayAud * 100),
          deadline: input.deadline,
          country: "AU",
          physicalPresenceRequired: false,
        }),
      );
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "humanleg_get_task",
  {
    title: "Get HumanLeg task",
    description:
      "Retrieve the current task, content version, hash and lifecycle status.",
    inputSchema: { taskId: z.string().uuid() },
  },
  async ({ taskId }) => {
    try {
      return result(await client.getTask(taskId));
    } catch (error) {
      return failure(error);
    }
  },
);

server.registerTool(
  "humanleg_get_compliance_review",
  {
    title: "Get HumanLeg compliance review",
    description: "Retrieve the exact-content compliance decision for a task.",
    inputSchema: { taskId: z.string().uuid() },
  },
  async ({ taskId }) => {
    try {
      return result(await client.getComplianceReview(taskId));
    } catch (error) {
      return failure(error);
    }
  },
);

if (process.env.HUMANLEG_ENABLE_SETTLEMENT === "true") {
  server.registerTool(
    "humanleg_fund_task",
    {
      title: "Fund HumanLeg task",
      description:
        "Create a funding intent for an approved task. Sandbox value only. Funding does not publish.",
      inputSchema: { taskId: z.string().uuid() },
    },
    async ({ taskId }) => {
      try {
        return result(await client.createFundingIntent(taskId));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "humanleg_publish_task",
    {
      title: "Publish HumanLeg task",
      description:
        "Explicitly publish a funded task only if its current exact content version remains approved.",
      inputSchema: {
        taskId: z.string().uuid(),
        expectedVersion: z.number().int().positive(),
      },
    },
    async ({ taskId, expectedVersion }) => {
      try {
        return result(await client.publishTask(taskId, expectedVersion));
      } catch (error) {
        return failure(error);
      }
    },
  );
}

await server.connect(new StdioServerTransport());
