export interface HumanLegClientOptions {
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
  idempotencyKey?: () => string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  correlationId?: string;
}

export class HumanLegApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(
      problem.detail ??
        problem.title ??
        `HumanLeg API request failed with ${status}`,
    );
    this.name = "HumanLegApiError";
    this.status = status;
    this.problem = problem;
  }
}

export interface FeeQuoteInput {
  rewardAtomic: number;
  displayAudCents: number;
}

export interface FeeQuote extends FeeQuoteInput {
  id: string;
  expiresAt?: string;
  feeAtomic?: number;
}

export interface CreateTaskInput {
  feeQuoteId: string;
  category: "REMOTE_VERIFICATION";
  title: string;
  instructions: string;
  evidenceRequirements: string[];
  rewardAtomic: number;
  displayAudCents: number;
  deadline: string;
  country: "AU";
  physicalPresenceRequired: false;
}

export interface UpdateTaskInput {
  expectedVersion: number;
  title: string;
  instructions: string;
  evidenceRequirements: string[];
  deadline: string;
}

export interface Task {
  id: string;
  status: string;
  contentVersion: number;
  contentHash?: string;
  title: string;
  instructions: string;
  evidenceRequirements: string[];
  rewardAtomic: number;
  displayAudCents: number;
  deadline: string;
  country: string;
  complianceReview?: ComplianceReview;
  [key: string]: unknown;
}

export interface ComplianceReview {
  id?: string;
  decision: "APPROVE" | "REJECT" | "ESCALATE_TO_HUMAN" | "PENDING" | "ERROR";
  reasonCode?: string | null;
  contentVersion?: number;
  contentHash?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface EventPage {
  events: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  idempotent?: boolean;
};

function defaultIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export class HumanLegClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly nextIdempotencyKey: () => string;

  constructor(options: HumanLegClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.nextIdempotencyKey = options.idempotencyKey ?? defaultIdempotencyKey;
    if (
      !this.baseUrl.startsWith("http://") &&
      !this.baseUrl.startsWith("https://")
    ) {
      throw new TypeError("baseUrl must use http:// or https://");
    }
    if (!this.token) throw new TypeError("token is required");
  }

  async createFeeQuote(input: FeeQuoteInput): Promise<FeeQuote> {
    return this.request("/v1/fee-quotes", {
      method: "POST",
      body: input,
      idempotent: true,
    });
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request("/v1/tasks", {
      method: "POST",
      body: input,
      idempotent: true,
    });
  }

  async getTask(id: string): Promise<Task> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}`);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
      idempotent: true,
    });
  }

  async getComplianceReview(id: string): Promise<ComplianceReview> {
    return this.request(
      `/v1/tasks/${encodeURIComponent(id)}/compliance-review`,
    );
  }

  async createFundingIntent(id: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/funding-intents`, {
      method: "POST",
      idempotent: true,
    });
  }

  async publishTask(id: string, expectedVersion: number): Promise<Task> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/open`, {
      method: "POST",
      body: { expectedVersion },
      idempotent: true,
    });
  }

  async cancelTask(id: string): Promise<Task> {
    return this.request(`/v1/tasks/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      idempotent: true,
    });
  }

  async listEvents(after?: string): Promise<EventPage> {
    const query = after ? `?after=${encodeURIComponent(after)}` : "";
    return this.request(`/v1/events${query}`);
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${this.token}`,
    });
    if (options.body !== undefined)
      headers.set("content-type", "application/json");
    if (options.idempotent)
      headers.set("idempotency-key", this.nextIdempotencyKey());

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const body = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok)
      throw new HumanLegApiError(response.status, body as ProblemDetails);
    return body as T;
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export async function sha256Canonical(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0),
  );
  return bytes;
}

export async function verifyWebhookSignature(input: {
  webhookId: string;
  timestamp: number;
  rawBody: string;
  signature: string;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(now - input.timestamp) > tolerance) return false;
  const rawSecret = input.secret.replace(/^whsec_/, "");
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    decodeBase64Url(rawSecret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = new TextEncoder().encode(
    `${input.webhookId}.${input.timestamp}.${input.rawBody}`,
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, payload);
  const expected = `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
  if (expected.length !== input.signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |=
      expected.charCodeAt(index) ^ input.signature.charCodeAt(index);
  }
  return difference === 0;
}
