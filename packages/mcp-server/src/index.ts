#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { HumanLegApiError, HumanLegClient } from "@humanleg/sdk";
import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
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

function createHumanLegServer(): McpServer {
  const server = new McpServer({ name: "humanleg", version: "0.2.0" });

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

  return server;
}

async function startHttpServer(): Promise<void> {
  const host = process.env.HUMANLEG_MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.HUMANLEG_MCP_PORT ?? 8788);
  const allowedHosts = (
    process.env.HUMANLEG_MCP_ALLOWED_HOSTS ??
    "humanleg.ai,www.humanleg.ai,127.0.0.1,localhost"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const app = createMcpExpressApp({ host, allowedHosts });

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: Number(process.env.HUMANLEG_MCP_RATE_LIMIT ?? 60),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Synthetic sandbox rate limit exceeded.",
        },
        id: null,
      },
    }),
  );

  app.get("/health", (_request: Request, response: Response) => {
    response.json({ status: "ok", mode: "synthetic-remote-mcp" });
  });

  app.post("/mcp", async (request: Request, response: Response) => {
    const server = createHumanLegServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
      response.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error("Remote MCP request failed", error);
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_request: Request, response: Response) => {
    response.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Use POST for stateless MCP requests." },
      id: null,
    });
  });

  app.listen(port, host, () => {
    console.log(`HumanLeg remote MCP listening on http://${host}:${port}/mcp`);
  });
}

if (process.env.HUMANLEG_MCP_TRANSPORT === "http") {
  await startHttpServer();
} else {
  await createHumanLegServer().connect(new StdioServerTransport());
}
