/**
 * Wallet reload (top-up) for the external Wallet API.
 * Picks the provider (explicit code, or the active provider with the lowest
 * priority number), opens a checkout with it, and on confirmation posts a
 * balanced ledger transaction: DEBIT 1001 Provider Settlement Clearing,
 * CREDIT the wallet's ledger account. The wallet balance follows the ledger.
 */
import type { ProviderRow } from "./payment-gateway.server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type WalletRow = {
  id: string;
  wallet_number: string;
  currency: string;
  status: string;
  available_balance: string;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
};

async function walletByNumber(walletNumber: string) {
  const { one } = await import("./mysql.server");
  const w = await one<WalletRow>(
    `SELECT w.id, w.wallet_number, w.currency, w.status, w.available_balance,
            COALESCE(u.organization_id, m.organization_id) AS organization_id,
            COALESCE(u.full_name, m.business_name) AS full_name,
            COALESCE(u.email, m.email) AS email, COALESCE(u.mobile, m.mobile) AS mobile
       FROM wallets w
       JOIN accounts a ON a.id = w.account_id
       JOIN parties p ON p.id = a.party_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN merchants m ON m.id = p.merchant_id
      WHERE w.wallet_number = ? LIMIT 1`,
    [walletNumber],
  );
  if (!w) throw new ApiError(404, "Wallet not found.");
  if (w.status !== "ACTIVE") throw new ApiError(409, "Wallet is not active.");
  return w;
}

/** Explicit provider code, or "DEFAULT"/blank = active provider with the best priority. */
export async function resolveProvider(code?: string | null): Promise<ProviderRow> {
  const { one } = await import("./mysql.server");
  const explicit = code && code.toUpperCase() !== "DEFAULT";
  const p = explicit
    ? await one<ProviderRow>("SELECT * FROM payment_providers WHERE code = ? LIMIT 1", [code])
    : await one<ProviderRow>(
        "SELECT * FROM payment_providers WHERE enabled = 1 AND status = 'ACTIVE' ORDER BY priority ASC, created_at ASC LIMIT 1",
      );
  if (!p) throw new ApiError(404, explicit ? `Payment provider ${code} not found.` : "No active payment provider.");
  if (!Number(p.enabled) || p.status !== "ACTIVE") throw new ApiError(409, `Payment provider ${p.code} is not switched on.`);
  return p;
}

const intentEnv = (env: string) => (env === "production" || env === "live" ? "live" : "sandbox");

export async function startReload(args: {
  walletNumber: string;
  amount: number;
  providerCode?: string | null;
  methodCode?: string | null;
  reference?: string | null;
  description?: string | null;
  returnUrl?: string | null;
  actorId?: string | null;
}) {
  const m = await import("./mysql.server");
  const { createProviderCharge } = await import("./payment-gateway.server");
  const wallet = await walletByNumber(args.walletNumber);
  const provider = await resolveProvider(args.providerCode);
  const p = provider as ProviderRow & { min_amount?: string; max_amount?: string | null };
  if (Number(p.min_amount ?? 0) > args.amount) throw new ApiError(400, `Minimum reload is ${p.min_amount}.`);
  if (p.max_amount != null && Number(p.max_amount) < args.amount) throw new ApiError(400, `Maximum reload is ${p.max_amount}.`);

  const reference = args.reference || m.makeReference("RLD");
  if (await m.one("SELECT id FROM payment_intents WHERE reference = ?", [reference])) {
    throw new ApiError(409, "This reference was already used.");
  }

  const charge = await createProviderCharge(provider, {
    reference,
    amount: args.amount,
    currency: wallet.currency,
    methodCode: args.methodCode ?? null,
    description: args.description ?? "Wallet reload",
    customer: { name: wallet.full_name ?? "CBS Customer", email: wallet.email, phone: wallet.mobile },
    ...(args.returnUrl ? { returnUrl: args.returnUrl } : {}),
  });
  if (charge.status === "FAILED") {
    const raw = charge.raw as { message?: string[] | string; error?: { message?: string } } | null;
    const msg = Array.isArray(raw?.message) ? raw.message.join(", ") : raw?.message ?? raw?.error?.message;
    throw new ApiError(502, `${provider.name} refused the payment${msg ? `: ${msg}` : "."}`);
  }

  const id = await m.newId();
  await m.query(
    `INSERT INTO payment_intents (id, provider_id, method_code, wallet_id, amount, currency, status, environment,
       provider_reference, checkout_url, reference, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`,
    [
      id, provider.id, args.methodCode ?? null, wallet.id, args.amount, wallet.currency, intentEnv(provider.environment),
      charge.providerReference, charge.checkoutUrl, reference,
      JSON.stringify({ simulated: charge.simulated, description: args.description ?? null }), args.actorId ?? null,
    ],
  );
  await m.audit(args.actorId ?? null, "WALLET_RELOAD_STARTED", "payment_intents", id, {
    reference, provider: provider.code, amount: args.amount, wallet_number: wallet.wallet_number,
  });

  // Simulated providers settle instantly.
  const confirmed = charge.status === "SUCCEEDED" ? await confirmReload(reference, args.actorId ?? null) : null;

  return {
    intentId: id,
    reference,
    status: confirmed?.status ?? "PENDING",
    provider: { code: provider.code, name: provider.name, environment: provider.environment },
    checkoutUrl: charge.checkoutUrl,
    simulated: charge.simulated,
    transactionId: confirmed?.transactionId ?? null,
    amount: args.amount,
    currency: wallet.currency,
  };
}

type IntentRow = {
  id: string;
  status: string;
  amount: string;
  currency: string;
  reference: string;
  provider_reference: string | null;
  transaction_id: string | null;
  wallet_id: string;
  provider_id: string;
  wallet_number: string;
  organization_id: string | null;
};

export async function intentByReference(reference: string) {
  const { one } = await import("./mysql.server");
  const i = await one<IntentRow>(
    `SELECT pi.*, w.wallet_number, COALESCE(u.organization_id, mm.organization_id) AS organization_id
       FROM payment_intents pi
       JOIN wallets w ON w.id = pi.wallet_id
       JOIN accounts a ON a.id = w.account_id
       JOIN parties p ON p.id = a.party_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN merchants mm ON mm.id = p.merchant_id
      WHERE pi.reference = ? LIMIT 1`,
    [reference],
  );
  if (!i) throw new ApiError(404, "Reload not found.");
  return i;
}

/** Ask the provider for the payment result; credit the wallet once on success. */
export async function confirmReload(reference: string, actorId: string | null = null) {
  const m = await import("./mysql.server");
  const { fetchProviderCharge } = await import("./payment-gateway.server");
  const intent = await intentByReference(reference);
  if (intent.status === "SUCCEEDED" || intent.status === "FAILED") {
    return { reference, status: intent.status, transactionId: intent.transaction_id };
  }
  const provider = await m.one<ProviderRow>("SELECT * FROM payment_providers WHERE id = ?", [intent.provider_id]);
  if (!provider) throw new ApiError(404, "Payment provider no longer exists.");
  const result = await fetchProviderCharge(provider, intent.provider_reference ?? intent.reference);

  if (result.status === "PENDING") return { reference, status: "PENDING", transactionId: null };
  if (result.status === "FAILED") {
    await m.query("UPDATE payment_intents SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'", [intent.id]);
    await m.audit(actorId, "WALLET_RELOAD_FAILED", "payment_intents", intent.id, { reference });
    return { reference, status: "FAILED", transactionId: null };
  }

  return m.tx(async (conn) => {
    const locked = await m.one<{ status: string; transaction_id: string | null }>(
      "SELECT status, transaction_id FROM payment_intents WHERE id = ? FOR UPDATE",
      [intent.id],
      conn,
    );
    if (locked!.status === "SUCCEEDED") return { reference, status: "SUCCEEDED", transactionId: locked!.transaction_id };
    const walletLedger = await m.one<{ id: string }>(
      "SELECT id FROM ledger_accounts WHERE wallet_id = ? LIMIT 1",
      [intent.wallet_id],
      conn,
    );
    if (!walletLedger) throw new ApiError(500, "Wallet has no ledger account.");
    const clearing = await m.ledgerAccountByCode("1001", conn);
    const amount = Number(intent.amount);
    const transactionId = await m.postTransaction(conn, {
      reference: intent.reference,
      transactionType: "WALLET_RELOAD",
      description: `Wallet reload via ${provider.code}`,
      currency: intent.currency,
      organizationId: intent.organization_id,
      idempotencyKey: `RELOAD-${intent.reference}`,
      createdBy: actorId,
      entries: [
        { ledger_account_id: clearing, direction: "DEBIT", amount },
        { ledger_account_id: walletLedger.id, direction: "CREDIT", amount },
      ],
    });
    await m.query("UPDATE payment_intents SET status = 'SUCCEEDED', transaction_id = ? WHERE id = ?", [transactionId, intent.id], conn);
    await m.audit(actorId, "WALLET_RELOAD_POSTED", "payment_intents", intent.id, {
      reference, amount, provider: provider.code, wallet_number: intent.wallet_number,
    }, conn);
    return { reference, status: "SUCCEEDED", transactionId };
  });
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return Response.json({ success: false, message: error.message }, { status: error.status });
  const e = error as { status?: number; message?: string; code?: string };
  if (e?.status && e.status < 500) return Response.json({ success: false, error: e.code, message: e.message }, { status: e.status });
  console.error("[wallet-api]", error);
  return Response.json({ success: false, message: e?.message || "Request failed." }, { status: 500 });
}
