#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

type Review = {
  id: string;
  decision: "APPROVE" | "REJECT";
  reasonCode: string | null;
  contentVersion: number;
  contentHash: string;
  expiresAt: string;
};

type Task = {
  id: string;
  status: "DRAFT" | "FUNDED" | "OPEN" | "CANCELLED";
  contentVersion: number;
  contentHash: string;
  category: "REMOTE_VERIFICATION";
  title: string;
  instructions: string;
  evidenceRequirements: string[];
  rewardAtomic: number;
  displayAudCents: number;
  deadline: string;
  country: "AU";
  physicalPresenceRequired: false;
  feeQuoteId: string;
  funded: boolean;
  complianceReview: Review;
};

const port = Number(process.env.PORT ?? 8787);
const token = process.env.HUMANLEG_AGENT_TOKEN ?? "sandbox-agent-token";
const settlementEnabled = process.env.HUMANLEG_ENABLE_SETTLEMENT === "true";
const maxBodyBytes = Number(process.env.HUMANLEG_MAX_BODY_BYTES ?? 64 * 1024);
const maxObjects = Number(process.env.HUMANLEG_MAX_OBJECTS ?? 500);
const maxEvents = Number(process.env.HUMANLEG_MAX_EVENTS ?? 2_000);
const requestsPerMinute = Number(
  process.env.HUMANLEG_REQUESTS_PER_MINUTE ?? 120,
);
const tasks = new Map<string, Task>();
const quotes = new Map<string, Record<string, unknown>>();
const events: Array<Record<string, unknown>> = [];
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function contentSnapshot(
  task: Omit<Task, "contentHash" | "complianceReview" | "funded" | "status">,
) {
  return {
    taskId: task.id,
    contentVersion: task.contentVersion,
    category: task.category,
    title: task.title,
    instructions: task.instructions,
    evidenceRequirements: task.evidenceRequirements,
    rewardAtomic: task.rewardAtomic,
    displayAudCents: task.displayAudCents,
    deadline: task.deadline,
    country: task.country,
    physicalPresenceRequired: task.physicalPresenceRequired,
  };
}

function reviewTask(
  task: Omit<Task, "contentHash" | "complianceReview" | "funded" | "status">,
): { contentHash: string; complianceReview: Review } {
  const contentHash = createHash("sha256")
    .update(canonicalJson(contentSnapshot(task)))
    .digest("hex");
  const text = `${task.title}\n${task.instructions}`.toLowerCase();
  const prohibited: Array<[RegExp, string]> = [
    [
      /gift[ -]?card|cash transfer|bank transfer|wire transfer/,
      "P_FINANCIAL_VALUE_TRANSFER",
    ],
    [
      /password|one[ -]?time password|\botp\b|seed phrase|private key/,
      "P_CREDENTIAL_THEFT",
    ],
    [/phishing|impersonat(e|ion)|doxx/, "P_FRAUD_OR_HARASSMENT"],
  ];
  const match = prohibited.find(([pattern]) => pattern.test(text));
  return {
    contentHash,
    complianceReview: {
      id: randomUUID(),
      decision: match ? "REJECT" : "APPROVE",
      reasonCode: match?.[1] ?? null,
      contentVersion: task.contentVersion,
      contentHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function problem(
  response: ServerResponse,
  status: number,
  code: string,
  detail: string,
): void {
  json(response, status, {
    type: `https://humanleg.ai/problems/${code}`,
    title: detail,
    status,
    code,
    detail,
  });
}

async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBodyBytes)
      throw new Error("Request body exceeds sandbox limit.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function requestKey(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  return request.socket.remoteAddress ?? "unknown";
}

function withinRateLimit(request: IncomingMessage): boolean {
  const key = requestKey(request);
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= requestsPerMinute;
}

function setBounded<T>(map: Map<string, T>, key: string, value: T): void {
  map.set(key, value);
  while (map.size > maxObjects) {
    const oldest = map.keys().next().value as string | undefined;
    if (!oldest) break;
    map.delete(oldest);
  }
}

function authenticate(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  if (request.headers.authorization !== `Bearer ${token}`) {
    problem(
      response,
      401,
      "unauthorized",
      "A valid sandbox bearer token is required.",
    );
    return false;
  }
  return true;
}

function requireIdempotency(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || key.length < 8) {
    problem(
      response,
      400,
      "idempotency_key_required",
      "Idempotency-Key must be at least 8 characters.",
    );
    return false;
  }
  return true;
}

function emit(type: string, task: Task): void {
  events.push({
    id: randomUUID(),
    type,
    taskId: task.id,
    at: new Date().toISOString(),
  });
  if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? "GET";
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );
    if (method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers":
          "authorization,content-type,idempotency-key",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      });
      return response.end();
    }
    if (!withinRateLimit(request)) {
      return problem(
        response,
        429,
        "rate_limit_exceeded",
        "Synthetic sandbox request limit exceeded; retry in one minute.",
      );
    }
    if (method === "GET" && url.pathname === "/health") {
      return json(response, 200, { status: "ok", mode: "synthetic-sandbox" });
    }
    if (method === "GET" && url.pathname === "/v1/capabilities") {
      return json(response, 200, {
        name: "HumanLeg.ai public synthetic sandbox",
        mode: "synthetic-sandbox",
        dispatchesRealHumans: false,
        movesRealFunds: false,
        settlementSimulationEnabled: settlementEnabled,
        categories: ["REMOTE_VERIFICATION"],
        tools: ["quote", "create_task", "get_task", "get_compliance_review"],
        constraints: {
          country: "AU",
          physicalPresenceRequired: false,
          minimumSyntheticRewardUsdc: 20,
        },
        documentation: "https://humanleg.ai/developers",
        mcp: "https://humanleg.ai/mcp",
      });
    }
    if (!authenticate(request, response)) return;

    if (method === "POST" && url.pathname === "/v1/fee-quotes") {
      if (!requireIdempotency(request, response)) return;
      const input = await body(request);
      const rewardAtomic = Number(input.rewardAtomic);
      const displayAudCents = Number(input.displayAudCents);
      if (!Number.isInteger(rewardAtomic) || rewardAtomic < 20_000_000) {
        return problem(
          response,
          422,
          "reward_too_low",
          "Sandbox reward must be at least 20 USDC.",
        );
      }
      const quote = {
        id: randomUUID(),
        rewardAtomic,
        displayAudCents,
        feeAtomic: Math.max(3_000_000, Math.ceil(rewardAtomic * 0.15)),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      setBounded(quotes, String(quote.id), quote);
      return json(response, 201, quote);
    }

    if (method === "POST" && url.pathname === "/v1/tasks") {
      if (!requireIdempotency(request, response)) return;
      const input = await body(request);
      if (!quotes.has(String(input.feeQuoteId))) {
        return problem(
          response,
          422,
          "fee_quote_invalid",
          "Create a current fee quote first.",
        );
      }
      const base = {
        id: randomUUID(),
        contentVersion: 1,
        category: "REMOTE_VERIFICATION" as const,
        title: String(input.title ?? ""),
        instructions: String(input.instructions ?? ""),
        evidenceRequirements: Array.isArray(input.evidenceRequirements)
          ? input.evidenceRequirements.map(String)
          : [],
        rewardAtomic: Number(input.rewardAtomic),
        displayAudCents: Number(input.displayAudCents),
        deadline: String(input.deadline),
        country: "AU" as const,
        physicalPresenceRequired: false as const,
        feeQuoteId: String(input.feeQuoteId),
      };
      if (
        base.title.length < 3 ||
        base.instructions.length < 10 ||
        base.evidenceRequirements.length < 1
      ) {
        return problem(
          response,
          422,
          "task_invalid",
          "Title, instructions and evidence requirements are required.",
        );
      }
      const review = reviewTask(base);
      const task: Task = { ...base, ...review, status: "DRAFT", funded: false };
      setBounded(tasks, task.id, task);
      emit("task.created", task);
      return json(response, 201, task);
    }

    const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)(?:\/(.*))?$/);
    if (taskMatch) {
      const id = decodeURIComponent(taskMatch[1] ?? "");
      const action = taskMatch[2];
      const task = tasks.get(id);
      if (!task)
        return problem(response, 404, "task_not_found", "Task not found.");

      if (method === "GET" && !action) return json(response, 200, task);
      if (method === "GET" && action === "compliance-review") {
        return json(response, 200, task.complianceReview);
      }
      if (method === "PATCH" && !action) {
        if (!requireIdempotency(request, response)) return;
        const input = await body(request);
        if (Number(input.expectedVersion) !== task.contentVersion) {
          return problem(
            response,
            409,
            "version_conflict",
            "Task version changed; reload before editing.",
          );
        }
        const base = {
          id: task.id,
          contentVersion: task.contentVersion + 1,
          category: task.category,
          title: String(input.title ?? task.title),
          instructions: String(input.instructions ?? task.instructions),
          evidenceRequirements: Array.isArray(input.evidenceRequirements)
            ? input.evidenceRequirements.map(String)
            : task.evidenceRequirements,
          rewardAtomic: task.rewardAtomic,
          displayAudCents: task.displayAudCents,
          deadline: String(input.deadline ?? task.deadline),
          country: task.country,
          physicalPresenceRequired: task.physicalPresenceRequired,
          feeQuoteId: task.feeQuoteId,
        };
        const updated: Task = {
          ...task,
          ...base,
          ...reviewTask(base),
          status: "DRAFT",
          funded: false,
        };
        tasks.set(id, updated);
        emit("task.updated", updated);
        return json(response, 200, updated);
      }
      if (method === "POST" && action === "funding-intents") {
        if (!requireIdempotency(request, response)) return;
        if (!settlementEnabled) {
          return problem(
            response,
            403,
            "settlement_disabled",
            "Funding is not available in the public developer sandbox.",
          );
        }
        if (task.complianceReview.decision !== "APPROVE") {
          return problem(
            response,
            409,
            "compliance_not_approved",
            "Rejected tasks cannot be funded.",
          );
        }
        task.funded = true;
        task.status = "FUNDED";
        emit("task.funded", task);
        return json(response, 201, {
          id: randomUUID(),
          taskId: id,
          status: "CONFIRMED",
          simulated: true,
        });
      }
      if (method === "POST" && action === "open") {
        if (!requireIdempotency(request, response)) return;
        if (!settlementEnabled) {
          return problem(
            response,
            403,
            "publication_disabled",
            "Publication is not available in the public developer sandbox.",
          );
        }
        const input = await body(request);
        const review = task.complianceReview;
        if (
          review.decision !== "APPROVE" ||
          review.contentVersion !== task.contentVersion ||
          review.contentHash !== task.contentHash ||
          Date.parse(review.expiresAt) <= Date.now()
        ) {
          return problem(
            response,
            409,
            "compliance_not_current",
            "Exact current approval is required.",
          );
        }
        if (!task.funded)
          return problem(
            response,
            409,
            "task_not_funded",
            "Fund the task before publication.",
          );
        if (Number(input.expectedVersion) !== task.contentVersion) {
          return problem(
            response,
            409,
            "version_conflict",
            "Task version changed before publication.",
          );
        }
        task.status = "OPEN";
        emit("task.opened", task);
        return json(response, 200, task);
      }
      if (method === "POST" && action === "cancel") {
        if (!requireIdempotency(request, response)) return;
        task.status = "CANCELLED";
        emit("task.cancelled", task);
        return json(response, 200, task);
      }
    }

    if (method === "GET" && url.pathname === "/v1/events") {
      const after = url.searchParams.get("after");
      const filtered = after
        ? events.filter((event) => String(event.at) > after)
        : events;
      return json(response, 200, { events: filtered });
    }

    return problem(response, 404, "route_not_found", "Route not found.");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Request body exceeds sandbox limit."
    ) {
      return problem(response, 413, "request_too_large", error.message);
    }
    return problem(
      response,
      500,
      "sandbox_error",
      error instanceof Error ? error.message : "Unexpected sandbox error.",
    );
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `HumanLeg synthetic sandbox listening on http://127.0.0.1:${port}`,
  );
});
