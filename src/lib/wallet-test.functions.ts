import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Staff test bench for the Wallet API reload flow. Uses the exact same
 * startReload / confirmReload code as POST /api/v1/wallets/reload and
 * /reload/confirm, against the MySQL CBS database, so a reload tested here
 * behaves the same as one from the wallet app.
 */

export type TestWallet = {
  wallet_number: string;
  currency: string;
  available_balance: string;
  holder: string;
  user_code: string | null;
};

export type TestProvider = { code: string; name: string; environment: string; priority: number };

export type TestReload = {
  reference: string;
  wallet_number: string;
  holder: string;
  provider_code: string;
  amount: string;
  currency: string;
  status: string;
  checkout_url: string | null;
  created_at: string;
};

export const loadWalletTestBench = createServerFn({ method: "POST" }).handler(async () => {
  const m = await import("./mysql.server");
  await m.requireStaff();
  const wallets = await m.query<TestWallet>(
    `SELECT w.wallet_number, w.currency, w.available_balance,
            COALESCE(u.full_name, mm.business_name, p.display_name) AS holder,
            COALESCE(u.user_code, mm.merchant_code) AS user_code
       FROM wallets w
       JOIN accounts a ON a.id = w.account_id
       JOIN parties p ON p.id = a.party_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN merchants mm ON mm.id = p.merchant_id
      WHERE w.status = 'ACTIVE'
      ORDER BY p.party_type ASC, w.wallet_number ASC`,
  );
  const providers = await m.query<TestProvider>(
    `SELECT code, name, environment, priority FROM payment_providers
      WHERE enabled = 1 AND status = 'ACTIVE' ORDER BY priority ASC, created_at ASC`,
  );
  const reloads = await m.query<TestReload>(
    `SELECT pi.reference, w.wallet_number, COALESCE(u.full_name, mm.business_name, p.display_name) AS holder,
            pp.code AS provider_code, pi.amount, pi.currency, pi.status, pi.checkout_url, pi.created_at
       FROM payment_intents pi
       JOIN wallets w ON w.id = pi.wallet_id
       JOIN accounts a ON a.id = w.account_id
       JOIN parties p ON p.id = a.party_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN merchants mm ON mm.id = p.merchant_id
       JOIN payment_providers pp ON pp.id = pi.provider_id
      ORDER BY pi.created_at DESC LIMIT 30`,
  );
  return { wallets, providers, reloads };
});

export const startWalletTestReload = createServerFn({ method: "POST" })
  .inputValidator((input: { walletNumber: string; amount: number; providerCode: string; returnUrl: string }) =>
    z
      .object({
        walletNumber: z.string().trim().min(1).max(40),
        amount: z.number().min(1).max(100000),
        providerCode: z.string().trim().max(40),
        returnUrl: z.string().url().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireWriter();
    const { startReload, ApiError } = await import("./wallet-reload.server");
    try {
      const res = await startReload({
        walletNumber: data.walletNumber,
        amount: data.amount,
        providerCode: data.providerCode || "DEFAULT",
        description: "Wallet reload test",
        returnUrl: data.returnUrl,
        actorId: staff.id,
      });
      return { ok: true as const, ...res };
    } catch (error) {
      if (error instanceof ApiError) return { ok: false as const, error: error.message };
      throw error;
    }
  });

export const confirmWalletTestReload = createServerFn({ method: "POST" })
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireWriter();
    const { confirmReload, intentByReference } = await import("./wallet-reload.server");
    const intent = await intentByReference(data.reference);
    const result = await confirmReload(data.reference, staff.id);
    const w = await m.one<{ available_balance: string; currency: string }>(
      "SELECT available_balance, currency FROM wallets WHERE id = ?",
      [intent.wallet_id],
    );
    return {
      ...result,
      walletNumber: intent.wallet_number,
      amount: Number(intent.amount),
      availableBalance: Number(w?.available_balance ?? 0),
      currency: w?.currency ?? intent.currency,
    };
  });
