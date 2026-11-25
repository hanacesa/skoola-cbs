/**
 * Generic payment provider adapter (server-only).
 *
 * The HTTP contract of ANY provider is described by its `payment_providers`
 * row plus its encrypted rows in `payment_provider_credentials`:
 *
 *   base URLs         api_base_url (production) / sandbox_base_url
 *   auth              auth_type BEARER | HEADER_KEY | BASIC | SIGNATURE | NONE,
 *                     auth_header, auth_credential_key (which credential to send)
 *   operations        charge / status / refund / cancel: method + path ({id} substituted)
 *   config JSON       request / response field mapping, status_mapping,
 *                     extra headers, signature settings
 *
 * Provider statuses are normalised to the CBS canonical set via status_mapping.
 */
import { createHash, createHmac, randomUUID } from "crypto";

export type ProviderRow = {
  id: string;
  code: string;
  name: string;
  environment: string;
  enabled: boolean | number;
  status: string;
  api_base_url: string | null;
  sandbox_base_url: string | null;
  auth_type: string;
  auth_header: string;
  auth_credential_key?: string | null;
  credential_secret_name: string | null;
  charge_method?: string | null;
  charge_path: string;
  status_method?: string | null;
  status_path: string;
  config: Record<string, unknown> | string | null;
};

export type ProviderConfig = {
  amount_in_minor?: boolean;
  /** Generic mapping: provider field (dot path) -> $transaction.<field> */
  request?: Record<string, string>;
  /** Where to read canonical fields from the provider response. */
  response?: { provider_reference?: string; status?: string; checkout_url?: string; message?: string };
  /** Provider status -> SUCCESS | PENDING | FAILED | CANCELLED */
  status_mapping?: Record<string, string>;
  headers?: Record<string, string>;
  signature?: { algorithm?: string; secret_credential?: string; header?: string };
  extra_body?: Record<string, unknown>;
  // legacy keys (still honoured)
  amount_field?: string;
  currency_field?: string;
  reference_field?: string;
  method_field?: string;
  description_field?: string;
  extra_headers?: Record<string, string>;
  reference_path?: string;
  status_path_field?: string;
  checkout_url_path?: string;
  success_values?: string[];
  simulate?: boolean;
};

export type ChargeInput = {
  reference: string;
  amount: number;
  currency: string;
  methodCode?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Payer details; some gateways (senangPay / DOKU) reject charges without them. */
  customer?: { name: string; email?: string | null; phone?: string | null };
  /** Where the provider sends the payer after checkout. */
  returnUrl?: string;
};

type Canonical = "PENDING" | "SUCCEEDED" | "FAILED";

export type ChargeResult = {
  providerReference: string;
  status: Canonical;
  checkoutUrl: string | null;
  simulated: boolean;
  raw: unknown;
};

function pick(source: unknown, path?: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, source);
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let node = target;
  keys.slice(0, -1).forEach((k) => {
    if (!node[k] || typeof node[k] !== "object") node[k] = {};
    node = node[k] as Record<string, unknown>;
  });
  node[keys[keys.length - 1]!] = value;
}

function configOf(provider: ProviderRow): ProviderConfig {
  if (!provider.config) return {};
  if (typeof provider.config === "string") {
    try {
      return JSON.parse(provider.config) as ProviderConfig;
    } catch {
      return {};
    }
  }
  return provider.config as ProviderConfig;
}

export function providerBaseUrl(provider: ProviderRow): string | null {
  const prod = provider.environment === "production" || provider.environment === "live";
  return prod
    ? (provider.api_base_url ?? provider.sandbox_base_url ?? null)
    : (provider.sandbox_base_url ?? provider.api_base_url ?? null);
}

async function credentialsOf(provider: ProviderRow) {
  const { loadProviderCredentials } = await import("./credentials.server");
  return loadProviderCredentials(provider.id, provider.environment);
}

async function authHeaders(provider: ProviderRow, body: string, creds: Record<string, string>) {
  const config = configOf(provider);
  const header = provider.auth_header || "Authorization";
  let credential = provider.auth_credential_key ? creds[provider.auth_credential_key] : undefined;
  if (!credential && provider.credential_secret_name) credential = process.env[provider.credential_secret_name];

  if (provider.auth_type === "NONE") return {};
  if (!credential) {
    throw new Error(`Missing credential for provider ${provider.code}. Add it on the Payment providers page.`);
  }
  switch (provider.auth_type) {
    case "BEARER":
      return { [header]: `Bearer ${credential}` };
    case "BASIC":
      return { [header]: `Basic ${btoa(`${credential}:`)}` };
    case "HEADER_KEY":
      return { [header]: credential };
    case "SIGNATURE": {
      const secretKey = creds[config.signature?.secret_credential ?? "secret_key"];
      if (!secretKey) throw new Error(`Missing signing secret for provider ${provider.code}.`);
      const timestamp = new Date().toISOString();
      const digest = createHmac("sha256", secretKey).update(`${credential}:${timestamp}:${body}`).digest("base64");
      return {
        [header]: credential,
        "Request-Timestamp": timestamp,
        [config.signature?.header ?? "Signature"]: `HMACSHA256=${digest}`,
      };
    }
    default:
      return {};
  }
}

function normaliseStatus(config: ProviderConfig, value: unknown): Canonical {
  const raw = String(value ?? "PENDING");
  const mapped = config.status_mapping?.[raw] ?? config.status_mapping?.[raw.toLowerCase()] ?? config.status_mapping?.[raw.toUpperCase()];
  if (mapped) {
    const m = mapped.toUpperCase();
    if (m === "SUCCESS" || m === "SUCCEEDED") return "SUCCEEDED";
    if (m === "FAILED" || m === "CANCELLED") return "FAILED";
    return "PENDING";
  }
  const success = (config.success_values ?? ["SUCCEEDED", "SUCCESS", "PAID", "COMPLETED", "CAPTURED"]).map((v) => v.toUpperCase());
  if (success.includes(raw.toUpperCase())) return "SUCCEEDED";
  if (["FAILED", "DECLINED", "CANCELLED", "EXPIRED"].includes(raw.toUpperCase())) return "FAILED";
  return "PENDING";
}

function buildBody(config: ProviderConfig, input: ChargeInput) {
  const amount = config.amount_in_minor ? Math.round(input.amount * 100) : Number(input.amount.toFixed(2));
  const tx: Record<string, unknown> = { ...input, amount, method: input.methodCode };
  const body: Record<string, unknown> = {};
  if (config.request && Object.keys(config.request).length) {
    for (const [field, source] of Object.entries(config.request)) {
      const value = source.startsWith("$transaction.") ? tx[source.slice(13)] : source;
      if (value !== undefined && value !== null) setPath(body, field, value);
    }
  } else {
    body[config.amount_field ?? "amount"] = amount;
    body[config.currency_field ?? "currency"] = input.currency;
    body[config.reference_field ?? "reference"] = input.reference;
    if (input.methodCode) body[config.method_field ?? "payment_method"] = input.methodCode;
    if (input.description) body[config.description_field ?? "description"] = input.description;
  }
  if (input.metadata) body["metadata"] = input.metadata;
  if (input.customer && body["customer"] === undefined) body["customer"] = input.customer;
  return { ...body, ...(config.extra_body ?? {}) };
}

/** DOKU-style request signing (senangPay sandbox): Client-Id / Request-Id / Timestamp / Target / Digest. */
function isDokuStyle(provider: ProviderRow, baseUrl: string) {
  return provider.auth_type === "SIGNATURE" && /doku\.com/i.test(baseUrl);
}

function dokuHeaders(creds: Record<string, string>, target: string, body: string | null) {
  const clientId = creds["client_id"];
  const secret = creds["secret_key"];
  if (!clientId || !secret) throw new Error("Missing Client ID or Secret Key for this provider.");
  const requestId = randomUUID();
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  let component = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}`;
  if (body !== null) component += `\nDigest:${createHash("sha256").update(body).digest("base64")}`;
  return {
    "Client-Id": clientId,
    "Request-Id": requestId,
    "Request-Timestamp": timestamp,
    Signature: `HMACSHA256=${createHmac("sha256", secret).update(component).digest("base64")}`,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

/** Create a charge / top-up intent with the provider. */
export async function createProviderCharge(provider: ProviderRow, input: ChargeInput): Promise<ChargeResult> {
  if (!provider.enabled || provider.status !== "ACTIVE") {
    throw new Error(`Provider ${provider.code} is not enabled for routing.`);
  }
  const config = configOf(provider);
  const baseUrl = providerBaseUrl(provider);

  if (!baseUrl || config.simulate) {
    if (provider.environment === "production" && !config.simulate) {
      throw new Error(`Provider ${provider.code} has no API base URL configured.`);
    }
    return {
      providerReference: `SBX-${provider.code}-${input.reference}`,
      status: "SUCCEEDED",
      checkoutUrl: null,
      simulated: true,
      raw: { simulated: true, provider: provider.code, ...input },
    };
  }

  const creds = await credentialsOf(provider);
  if (isDokuStyle(provider, baseUrl)) {
    const target = provider.charge_path || "/checkout/v1/payment";
    const callback = input.returnUrl
      ? `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}reference=${encodeURIComponent(input.reference)}`
      : undefined;
    const bodyText = JSON.stringify({
      order: {
        amount: Number(input.amount.toFixed(2)),
        invoice_number: input.reference,
        currency: input.currency,
        ...(callback ? { callback_url: callback } : {}),
      },
      payment: { payment_due_date: 60 },
      customer: {
        name: input.customer?.name || "CBS Customer",
        email: input.customer?.email || "customer@example.com",
        phone: input.customer?.phone || "60123456789",
      },
    });
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${target}`, {
      method: "POST",
      headers: dokuHeaders(creds, target, bodyText),
      body: bodyText,
    });
    const raw = (await res.json().catch(() => ({}))) as { response?: { payment?: { url?: string } } };
    const url = raw.response?.payment?.url ?? null;
    return { providerReference: input.reference, status: res.ok && url ? "PENDING" : "FAILED", checkoutUrl: url, simulated: false, raw };
  }
  const bodyText = JSON.stringify(buildBody(config, input));
  const path = (provider.charge_path || "/v1/charges").replace(/\{(\w+)\}/g, (_, k: string) => creds[k] ?? "");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: provider.charge_method || "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...config.extra_headers,
      ...config.headers,
      ...(await authHeaders(provider, bodyText, creds)),
    },
    body: bodyText,
  });

  const text = await response.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  const refPath = config.response?.provider_reference ?? config.reference_path ?? "id";
  if (!response.ok) {
    console.error(`[provider:${provider.code}] charge failed`, response.status);
    return { providerReference: String(pick(raw, refPath) ?? input.reference), status: "FAILED", checkoutUrl: null, simulated: false, raw };
  }
  return {
    providerReference: String(pick(raw, refPath) ?? input.reference),
    status: normaliseStatus(config, pick(raw, config.response?.status ?? config.status_path_field ?? "status")),
    checkoutUrl: (pick(raw, config.response?.checkout_url ?? config.checkout_url_path ?? "checkout_url") as string | undefined) ?? null,
    simulated: false,
    raw,
  };
}

/** Read a charge back from the provider (used to confirm pending top-ups). */
export async function fetchProviderCharge(
  provider: ProviderRow,
  providerReference: string,
): Promise<{ status: Canonical; raw: unknown }> {
  const config = configOf(provider);
  const baseUrl = providerBaseUrl(provider);
  if (!baseUrl || config.simulate) return { status: "SUCCEEDED", raw: { simulated: true } };

  const creds = await credentialsOf(provider);
  if (isDokuStyle(provider, baseUrl)) {
    const target = (provider.status_path || "/orders/v1/status/{id}").replace("{id}", encodeURIComponent(providerReference));
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${target}`, { headers: dokuHeaders(creds, target, null) });
    const raw = (await res.json().catch(() => ({}))) as { transaction?: { status?: string } };
    const st = String(raw.transaction?.status ?? "PENDING").toUpperCase();
    return { status: st === "SUCCESS" ? "SUCCEEDED" : ["FAILED", "EXPIRED", "CANCELLED"].includes(st) ? "FAILED" : "PENDING", raw };
  }
  const path = (provider.status_path || "/v1/charges/{id}").replace("{id}", encodeURIComponent(providerReference));
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: provider.status_method || "GET",
    headers: { accept: "application/json", ...config.extra_headers, ...config.headers, ...(await authHeaders(provider, "", creds)) },
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) return { status: "FAILED", raw };
  return { status: normaliseStatus(config, pick(raw, config.response?.status ?? config.status_path_field ?? "status")), raw };
}

/** Reachability + credential check for the configured base URL. */
export async function pingProvider(provider: ProviderRow): Promise<{ reachable: boolean; detail: string }> {
  const baseUrl = providerBaseUrl(provider);
  if (!baseUrl || configOf(provider).simulate) {
    return { reachable: true, detail: "No endpoint configured — local sandbox simulation in use." };
  }
  try {
    const creds = await credentialsOf(provider);
    const headers = await authHeaders(provider, "", creds);
    const response = await fetch(baseUrl, { method: "GET", headers });
    return { reachable: response.status < 500, detail: `HTTP ${response.status}` };
  } catch (error) {
    return { reachable: false, detail: error instanceof Error ? error.message : "Unreachable" };
  }
}
