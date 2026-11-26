import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** One-time lazy seed: fills the senangPay sandbox Client ID if the database predates it. */
let senangPaySeed: Promise<void> | null = null;
function ensureSenangPayClientId(): Promise<void> {
  senangPaySeed ??= (async () => {
    try {
      const m = await import("./mysql.server");
      const { encryptCredential } = await import("./credentials.server");
      const provider = await m.one<{ id: string }>("SELECT id FROM payment_providers WHERE code = 'SENANGPAY' AND environment = 'sandbox'");
      if (!provider) return;
      const cred = await m.one<{ encrypted_value: string | null }>(
        "SELECT encrypted_value FROM payment_provider_credentials WHERE provider_id = ? AND environment = 'sandbox' AND credential_key = 'client_id'",
        [provider.id],
      );
      if (!cred) return;
      if (cred.encrypted_value) return;
      await m.query(
        "UPDATE payment_provider_credentials SET encrypted_value = ? WHERE provider_id = ? AND environment = 'sandbox' AND credential_key = 'client_id'",
        [encryptCredential("BRN-0221-1790574635839"), provider.id],
      );
    } catch {
      senangPaySeed = null;
    }
  })();
  return senangPaySeed;
}

const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((value) => value || null);

const jsonConfig = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return {} as Record<string, unknown>;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Config must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new Error("Field mapping must be valid JSON, e.g. {\"amount_in_minor\": true}");
    }
  });

const baseProvider = {
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  priority: z.coerce.number().int().min(1).max(999).default(10),
  enabled: z.boolean().default(true),
  authType: z.enum(["BEARER", "HEADER_KEY", "BASIC", "NONE"]).default("BEARER"),
  authHeader: z.string().trim().min(1).max(80).default("Authorization"),
  credentialSecretName: z
    .string()
    .trim()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Secret name may only contain letters, numbers and underscores.")
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  chargePath: z.string().trim().min(1).max(255).default("/v1/charges"),
  statusPath: z.string().trim().min(1).max(255).default("/v1/charges/{id}"),
  webhookUrl: optionalText,
  notes: z.string().trim().max(500).optional().transform((value) => value || null),
  config: jsonConfig,
};

/** Live/production API provider. */
const apiProviderSchema = z.object({
  ...baseProvider,
  apiBaseUrl: z.string().trim().url().max(255),
  sandboxBaseUrl: z.string().trim().url().max(255).optional().or(z.literal("")).transform((v) => v || null),
});

/** Sandbox provider — endpoint optional; without one, top-ups are simulated locally. */
const sandboxProviderSchema = z.object({
  ...baseProvider,
  sandboxBaseUrl: z.string().trim().url().max(255).optional().or(z.literal("")).transform((v) => v || null),
});

export type AddApiProviderInput = z.input<typeof apiProviderSchema>;
export type AddSandboxProviderInput = z.input<typeof sandboxProviderSchema>;

type ProviderInsert = {
  code: string;
  name: string;
  priority: number;
  enabled: boolean;
  environment: string;
  status: "ACTIVE" | "SUSPENDED";
  api_base_url: string | null;
  sandbox_base_url: string | null;
  auth_type: string;
  auth_header: string;
  credential_secret_name: string | null;
  charge_path: string;
  status_path: string;
  webhook_url: string | null;
  notes: string | null;
  config: Record<string, unknown>;
};

async function insertProvider(
  insert: ProviderInsert,
  actorId: string,
): Promise<{ id: string; code: string; environment: string }> {
  const m = await import("./mysql.server");
  const id = await m.newId();
  await m.query(
    `INSERT INTO payment_providers (id, code, name, priority, enabled, environment, status, api_base_url, sandbox_base_url,
       auth_type, auth_header, credential_secret_name, charge_path, status_path, webhook_url, notes, config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, insert.code, insert.name, insert.priority, insert.enabled ? 1 : 0, insert.environment, insert.status,
     insert.api_base_url, insert.sandbox_base_url, insert.auth_type, insert.auth_header, insert.credential_secret_name,
     insert.charge_path, insert.status_path, insert.webhook_url, insert.notes, JSON.stringify(insert.config)],
  );
  await m.audit(
    actorId,
    insert.environment === "production" ? "ADD_PAYMENT_PROVIDER_API" : "ADD_PAYMENT_PROVIDER_SANDBOX",
    "payment_providers",
    id,
    { code: insert.code, name: insert.name, environment: insert.environment },
  );
  return { id, code: insert.code, environment: insert.environment };
}

/** Register a payment provider against its live API. */
export const addApiPaymentProvider = createServerFn({ method: "POST" })
  .inputValidator((input: AddApiProviderInput) => apiProviderSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await (await import("./mysql.server")).requireAdmin();
    return insertProvider(
      {
        code: data.code,
        name: data.name,
        priority: data.priority,
        enabled: data.enabled,
        environment: "production",
        status: data.enabled ? "ACTIVE" : "SUSPENDED",
        api_base_url: data.apiBaseUrl,
        sandbox_base_url: data.sandboxBaseUrl,
        auth_type: data.authType,
        auth_header: data.authHeader,
        credential_secret_name: data.credentialSecretName,
        charge_path: data.chargePath,
        status_path: data.statusPath,
        webhook_url: data.webhookUrl,
        notes: data.notes,
        config: data.config,
      },
      staff.id,
    );
  });

/** Register a sandbox provider. Leave the URL empty to simulate top-ups locally. */
export const addSandboxPaymentProvider = createServerFn({ method: "POST" })
  .inputValidator((input: AddSandboxProviderInput) => sandboxProviderSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await (await import("./mysql.server")).requireAdmin();
    return insertProvider(
      {
        code: data.code,
        name: data.name,
        priority: data.priority,
        enabled: data.enabled,
        environment: "sandbox",
        status: data.enabled ? "ACTIVE" : "SUSPENDED",
        api_base_url: null,
        sandbox_base_url: data.sandboxBaseUrl,
        auth_type: data.authType,
        auth_header: data.authHeader,
        credential_secret_name: data.credentialSecretName,
        charge_path: data.chargePath,
        status_path: data.statusPath,
        webhook_url: data.webhookUrl,
        notes: data.notes,
        config: data.config,
      },
      staff.id,
    );
  });

const methodSchema = z.object({
  providerId: z.string().uuid(),
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(true),
});

export type AddPaymentMethodInput = z.input<typeof methodSchema>;

/** Attach a payment method (FPX, CARD, DUITNOW, …) to a provider. */
export const addPaymentMethod = createServerFn({ method: "POST" })
  .inputValidator((input: AddPaymentMethodInput) => methodSchema.parse(input))
  .handler(async ({ data }) => {
    const staff = await (await import("./mysql.server")).requireAdmin();
    const m = await import("./mysql.server");
    const id = await m.newId();
    await m.query("INSERT INTO payment_methods (id, provider_id, code, name, enabled) VALUES (?, ?, ?, ?, ?)", [
      id, data.providerId, data.code, data.name, data.enabled ? 1 : 0,
    ]);
    void staff;
    return { id, code: data.code };
  });

/** Probe a saved provider's endpoint and credential wiring. */
export const testPaymentProvider = createServerFn({ method: "POST" })
  .inputValidator((input: { providerId: string }) => z.object({ providerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const staff = await (await import("./mysql.server")).requireAdmin();
    void staff;
    await ensureSenangPayClientId();
    const { one } = await import("./mysql.server");
    const { pingProvider } = await import("./payment-gateway.server");
    const provider = await one("SELECT * FROM payment_providers WHERE id = ?", [data.providerId]);
    if (!provider) throw new Error("Provider not found.");
    try {
      return await pingProvider(provider as never);
    } catch (probeError) {
      return { reachable: false, detail: probeError instanceof Error ? probeError.message : "Probe failed" };
    }
  });

/* ------------------------------------------------------------------------ */
/* Template-driven providers with dynamic, encrypted credentials            */
/* ------------------------------------------------------------------------ */

const operationSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  path: z.string().trim().max(255).default(""),
});

const credentialInput = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/, "Credential keys use lowercase letters, numbers and _.").max(60),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "password", "textarea", "url"]).default("text"),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  value: z.string().max(20000).optional().default(""),
});

const jsonObject = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return {} as Record<string, unknown>;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch {
        /* fallthrough */
      }
      throw new Error(`${label} must be a valid JSON object.`);
    });

const createProviderSchema = z
  .object({
    code: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase()),
    name: z.string().trim().min(2).max(160),
    providerType: z.string().trim().min(2).max(40).default("PAYMENT_GATEWAY"),
    environment: z.enum(["sandbox", "production"]).default("sandbox"),
    enabled: z.boolean().default(true),
    priority: z.coerce.number().int().min(1).max(999).default(10),
    baseUrl: z.string().trim().url().max(255).optional().or(z.literal("")).transform((v) => v || null),
    authType: z.enum(["BEARER", "HEADER_KEY", "BASIC", "SIGNATURE", "NONE"]).default("BEARER"),
    authHeader: z.string().trim().min(1).max(80).default("Authorization"),
    authCredentialKey: z.string().trim().max(60).optional().transform((v) => v || null),
    operations: z.object({
      charge: operationSchema,
      status: operationSchema,
      refund: operationSchema,
      cancel: operationSchema,
    }),
    webhookUrl: z.string().trim().url().max(255).optional().or(z.literal("")).transform((v) => v || null),
    currency: z.string().trim().length(3).transform((v) => v.toUpperCase()).default("MYR"),
    minAmount: z.coerce.number().min(0).default(0),
    maxAmount: z.coerce.number().min(0).nullable().optional(),
    methods: z.array(z.object({ code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(120) })).default([]),
    credentials: z.array(credentialInput).max(30).default([]),
    fieldMapping: jsonObject("Field mapping"),
    headers: jsonObject("Request headers"),
    signature: jsonObject("Signature configuration"),
    notes: z.string().trim().max(500).optional().transform((v) => v || null),
  })
  .superRefine((data, ctx) => {
    if (data.environment === "production" && !data.baseUrl) {
      ctx.addIssue({ code: "custom", message: "A production provider needs a base URL.", path: ["baseUrl"] });
    }
    for (const cred of data.credentials) {
      if (cred.required && !cred.value.trim()) {
        ctx.addIssue({ code: "custom", message: `${cred.label} is required.`, path: ["credentials"] });
      }
    }
    if (data.maxAmount != null && data.maxAmount > 0 && data.maxAmount < data.minAmount) {
      ctx.addIssue({ code: "custom", message: "Maximum amount must be above the minimum.", path: ["maxAmount"] });
    }
  });

export type CreateProviderInput = z.input<typeof createProviderSchema>;

/** Create a provider from a template (or custom), with credentials for the chosen environment. */
export const createPaymentProvider = createServerFn({ method: "POST" })
  .inputValidator((input: CreateProviderInput) => createProviderSchema.parse(input))
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireAdmin();
    const { encryptCredential } = await import("./credentials.server");
    const existing = await m.one("SELECT id FROM payment_providers WHERE code = ?", [data.code]);
    if (existing) throw new Error(`A provider with code ${data.code} already exists.`);

    const config = { ...data.fieldMapping, headers: data.headers, signature: data.signature };
    const id = await m.newId();
    await m.tx(async (conn) => {
      await m.query(
        `INSERT INTO payment_providers (id, code, name, provider_type, priority, enabled, environment, status,
           api_base_url, sandbox_base_url, auth_type, auth_header, auth_credential_key,
           charge_method, charge_path, status_method, status_path, refund_method, refund_path, cancel_method, cancel_path,
           webhook_url, currency, min_amount, max_amount, notes, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.code, data.name, data.providerType, data.priority, data.enabled ? 1 : 0, data.environment,
          data.enabled ? "ACTIVE" : "SUSPENDED",
          data.environment === "production" ? data.baseUrl : null,
          data.environment === "sandbox" ? data.baseUrl : null,
          data.authType, data.authHeader, data.authCredentialKey,
          data.operations.charge.method, data.operations.charge.path || "/v1/charges",
          data.operations.status.method, data.operations.status.path || "/v1/charges/{id}",
          data.operations.refund.method, data.operations.refund.path || null,
          data.operations.cancel.method, data.operations.cancel.path || null,
          data.webhookUrl, data.currency, data.minAmount, data.maxAmount || null, data.notes, JSON.stringify(config),
        ],
        conn,
      );
      for (const cred of data.credentials) {
        const credId = await m.newId(conn);
        const value = cred.value.trim();
        await m.query(
          `INSERT INTO payment_provider_credentials
             (id, provider_id, environment, credential_key, credential_label, credential_type, encrypted_value, is_required, is_secret)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [credId, id, data.environment, cred.key, cred.label, cred.type, value ? encryptCredential(value) : null,
           cred.required ? 1 : 0, cred.secret ? 1 : 0],
          conn,
        );
      }
      for (const method of data.methods) {
        const methodId = await m.newId(conn);
        await m.query("INSERT INTO payment_methods (id, provider_id, code, name, enabled) VALUES (?, ?, ?, ?, 1)", [
          methodId, id, method.code.toUpperCase(), method.name,
        ], conn);
      }
    });
    await m.audit(staff.id, "ADD_PAYMENT_PROVIDER", "payment_providers", id, {
      code: data.code,
      environment: data.environment,
      credentials: data.credentials.map((c) => c.key),
    });
    return { id, code: data.code, environment: data.environment };
  });

export type ProviderCredentialView = {
  environment: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  secret: boolean;
  configured: boolean;
  /** Only returned for non-secret values (e.g. Client ID, public keys). */
  value: string | null;
};

/** Credential definitions for a provider. Secret values are never returned — only whether they are set. */
export const listProviderCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: { providerId: string }) => z.object({ providerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ProviderCredentialView[]> => {
    const m = await import("./mysql.server");
    await ensureSenangPayClientId();
    await m.requireStaff();
    const { decryptCredential } = await import("./credentials.server");
    const rows = await m.query<{
      environment: string; credential_key: string; credential_label: string; credential_type: string;
      encrypted_value: string | null; is_required: number; is_secret: number;
    }>(
      `SELECT environment, credential_key, credential_label, credential_type, encrypted_value, is_required, is_secret
       FROM payment_provider_credentials WHERE provider_id = ? ORDER BY environment, created_at`,
      [data.providerId],
    );
    return rows.map((r) => {
      let value: string | null = null;
      if (!r.is_secret && r.encrypted_value) {
        try {
          value = decryptCredential(r.encrypted_value);
        } catch {
          value = null;
        }
      }
      return {
        environment: r.environment,
        key: r.credential_key,
        label: r.credential_label,
        type: r.credential_type,
        required: Boolean(r.is_required),
        secret: Boolean(r.is_secret),
        configured: Boolean(r.encrypted_value),
        value,
      };
    });
  });

const setCredentialSchema = z.object({
  providerId: z.string().uuid(),
  environment: z.enum(["sandbox", "production"]),
  key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).max(60),
  label: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["text", "password", "textarea", "url"]).optional(),
  secret: z.boolean().optional(),
  value: z.string().max(20000),
});

/** Set or replace one credential for one environment (e.g. add production keys later). */
export const setProviderCredential = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof setCredentialSchema>) => setCredentialSchema.parse(input))
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireAdmin();
    const { encryptCredential } = await import("./credentials.server");
    const value = data.value.trim();
    const encrypted = value ? encryptCredential(value) : null;
    const existing = await m.one<{ id: string }>(
      "SELECT id FROM payment_provider_credentials WHERE provider_id = ? AND environment = ? AND credential_key = ?",
      [data.providerId, data.environment, data.key],
    );
    if (existing) {
      await m.query("UPDATE payment_provider_credentials SET encrypted_value = ? WHERE id = ?", [encrypted, existing.id]);
    } else {
      const id = await m.newId();
      await m.query(
        `INSERT INTO payment_provider_credentials
           (id, provider_id, environment, credential_key, credential_label, credential_type, encrypted_value, is_required, is_secret)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, data.providerId, data.environment, data.key, data.label ?? data.key, data.type ?? "password", encrypted,
         data.secret ?? true ? 1 : 0],
      );
    }
    await m.audit(staff.id, "SET_PROVIDER_CREDENTIAL", "payment_providers", data.providerId, {
      environment: data.environment,
      key: data.key,
      cleared: !value,
    });
    return { ok: true };
  });

/** Switch a provider between sandbox and production credentials. */
export const setProviderEnvironment = createServerFn({ method: "POST" })
  .inputValidator((input: { providerId: string; environment: "sandbox" | "production" }) =>
    z.object({ providerId: z.string().uuid(), environment: z.enum(["sandbox", "production"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireAdmin();
    await m.query("UPDATE payment_providers SET environment = ? WHERE id = ?", [data.environment, data.providerId]);
    await m.audit(staff.id, "SET_PROVIDER_ENVIRONMENT", "payment_providers", data.providerId, data);
    return { ok: true };
  });

/** Switch a provider ON (used by wallet reloads) or OFF. Wallet API calls stay the same. */
export const setProviderEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: { providerId: string; enabled: boolean }) =>
    z.object({ providerId: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireAdmin();
    await m.query("UPDATE payment_providers SET enabled = ?, status = ? WHERE id = ?", [
      data.enabled ? 1 : 0,
      data.enabled ? "ACTIVE" : "SUSPENDED",
      data.providerId,
    ]);
    await m.audit(staff.id, data.enabled ? "PROVIDER_SWITCHED_ON" : "PROVIDER_SWITCHED_OFF", "payment_providers", data.providerId, data);
    return { ok: true };
  });
